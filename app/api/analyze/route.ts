export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import {
  classifyDocument,
  extractDocumentData,
  extractCIMChunked,
  extractDocumentByPageChunks,
  streamMemoGeneration,
  streamMultiDocMemoGeneration,
  uploadPdf,
  verifyMemoSection,
} from "@/lib/claude";
import { getPdfPageCount, splitPdfByPageRanges } from "@/lib/pdf-utils";
import {
  isLlamaParseAvailable,
  assessTableQuality,
  parseWithLlamaParse,
} from "@/lib/llamaparse";
import { selectModel } from "@/lib/model-selector";
import { buildMemoData } from "@/lib/memo-parser";
import { buildFinancialModels } from "@/lib/financial-models";
import { processJob } from "@/lib/job-processor";
import type { SSEEvent, MemoFormat, DealSubType, MultiDocContext, ClassificationResult, ExtractedData } from "@/types";
import { SAMPLE_DOCUMENTS } from "@/lib/sample-documents";
import { readFileSync, existsSync } from "fs";
import { join } from "path";

// Threshold for async processing (large docs)
const ASYNC_PAGE_THRESHOLD = 50;
const ASYNC_SIZE_THRESHOLD = 3 * 1024 * 1024;

// Size threshold for chunked extraction (~100+ pages)
const CHUNKED_EXTRACTION_THRESHOLD = 5 * 1024 * 1024;

interface ParsedFile {
  pdfBase64: string;
  fileName: string;
  fileSize: number;
}

function sseEncode(data: SSEEvent): string {
  return `data: ${JSON.stringify(data)}\n\n`;
}

export async function POST(request: Request): Promise<Response> {
  // Auth check
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return new Response("Unauthorized", { status: 401 });
  }

  // Parse file(s)
  let parsedFiles: ParsedFile[] = [];
  let memoFormat: MemoFormat = "standard";

  try {
    const formData = await request.formData();

    // Optional memo format from form data
    const formatParam = formData.get("memo_format") as string | null;
    if (
      formatParam === "concise" ||
      formatParam === "standard" ||
      formatParam === "detailed"
    ) {
      memoFormat = formatParam;
    }

    // Check for sample document
    const sampleId = formData.get("sample_id") as string | null;
    if (sampleId) {
      const sample = SAMPLE_DOCUMENTS.find((s) => s.id === sampleId);
      if (!sample)
        return new Response("Invalid sample document", { status: 400 });

      const filePath = join(process.cwd(), "public", "samples", sample.fileName);
      if (!existsSync(filePath))
        return new Response("Sample document file not found", { status: 404 });

      const buffer = readFileSync(filePath);
      parsedFiles = [{
        pdfBase64: buffer.toString("base64"),
        fileName: sample.fileName,
        fileSize: buffer.length,
      }];
    } else {
      // Check for multiple files first
      const multiFiles = formData.getAll("files") as File[];
      if (multiFiles.length > 0) {
        for (const f of multiFiles) {
          if (f.type !== "application/pdf")
            return new Response(`${f.name}: Only PDF files are accepted`, { status: 400 });
          if (f.size > 32 * 1024 * 1024)
            return new Response(`${f.name} exceeds 32MB limit`, { status: 413 });

          const arrayBuffer = await f.arrayBuffer();
          parsedFiles.push({
            pdfBase64: Buffer.from(arrayBuffer).toString("base64"),
            fileName: f.name,
            fileSize: f.size,
          });
        }
      } else {
        // Single file
        const file = formData.get("file") as File | null;
        if (!file) return new Response("No file provided", { status: 400 });
        if (file.type !== "application/pdf")
          return new Response("Only PDF files are accepted", { status: 400 });
        if (file.size > 32 * 1024 * 1024)
          return new Response("File exceeds 32MB limit", { status: 413 });

        const arrayBuffer = await file.arrayBuffer();
        parsedFiles = [{
          pdfBase64: Buffer.from(arrayBuffer).toString("base64"),
          fileName: file.name,
          fileSize: file.size,
        }];
      }
    }
  } catch {
    return new Response("Failed to parse upload", { status: 400 });
  }

  if (parsedFiles.length === 0) {
    return new Response("No files provided", { status: 400 });
  }

  const userId = session.user.id;
  const isMultiDoc = parsedFiles.length > 1;

  // For single-doc, use backwards-compatible variable names
  const pdfBase64 = parsedFiles[0].pdfBase64;
  const fileName = parsedFiles[0].fileName;
  const fileSize = parsedFiles[0].fileSize;

  // Check if we should use async mode for large documents
  let earlyPageCount = 0;
  try {
    earlyPageCount = await getPdfPageCount(pdfBase64);
  } catch {
    // Continue without page count
  }

  const useAsync =
    earlyPageCount > ASYNC_PAGE_THRESHOLD ||
    fileSize > ASYNC_SIZE_THRESHOLD;

  if (useAsync) {
    // Create a processing job and return immediately
    const job = await prisma.processingJob.create({
      data: {
        userId,
        status: "pending",
        fileName,
        fileSize,
        pageCount: earlyPageCount || null,
        memoFormat,
      },
    });

    // Fire and forget — process in background
    processJob(job.id, pdfBase64, fileName, fileSize, memoFormat, userId).catch(
      (err) => console.error("Background job failed:", err)
    );

    return Response.json({ mode: "async", jobId: job.id });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        if (isMultiDoc) {
          // ── Multi-document pipeline ──
          await processMultiDoc(controller, encoder, parsedFiles, memoFormat, userId);
        } else {
          // ── Single-document pipeline ──
          await processSingleDoc(controller, encoder, pdfBase64, fileName, fileSize, memoFormat, userId);
        }
      } catch (error) {
        console.error("Analysis error:", error);
        controller.enqueue(
          encoder.encode(
            sseEncode({
              type: "error",
              message:
                error instanceof Error ? error.message : "Analysis failed",
            })
          )
        );
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}

// ── Single-document processing (original pipeline) ──

async function processSingleDoc(
  controller: ReadableStreamDefaultController,
  encoder: TextEncoder,
  pdfBase64: string,
  fileName: string,
  fileSize: number,
  memoFormat: MemoFormat,
  userId: string
) {
  let fileId: string | null = null;

  // Upload to Files API once for reuse across pipeline stages
  try {
    fileId = await uploadPdf(pdfBase64, fileName);
  } catch (err) {
    console.warn("Files API upload failed, falling back to base64:", err);
  }

  // Stage 1: Classify
  controller.enqueue(
    encoder.encode(sseEncode({ type: "stage", stage: "classifying" }))
  );
  const classifyModel = selectModel({ stage: "classify" });
  const classification = await classifyDocument(
    fileId ? null : pdfBase64,
    fileId,
    classifyModel
  );
  controller.enqueue(
    encoder.encode(
      sseEncode({ type: "classification", result: classification })
    )
  );

  const dealSubType: DealSubType =
    classification.deal_sub_type ?? "unknown";

  // Stage 2: Extract
  controller.enqueue(
    encoder.encode(sseEncode({ type: "stage", stage: "extracting" }))
  );

  // Detect page count for chunking decisions
  let pageCount = 0;
  try {
    pageCount = await getPdfPageCount(pdfBase64);
  } catch {
    // If page count detection fails, proceed without it
  }

  const extractModel = selectModel({
    stage: "extract",
    documentType: classification.document_type,
    memoFormat,
    pageCount,
  });

  let extractedData: ExtractedData;
  if (pageCount > 100) {
    const chunks = await splitPdfByPageRanges(pdfBase64, 95);
    extractedData = await extractDocumentByPageChunks(
      chunks,
      classification.document_type,
      extractModel
    );
  } else if (
    classification.document_type === "cim" &&
    fileSize > CHUNKED_EXTRACTION_THRESHOLD
  ) {
    extractedData = await extractCIMChunked(
      fileId ? null : pdfBase64,
      fileId,
      extractModel
    );
  } else {
    extractedData = await extractDocumentData(
      fileId ? null : pdfBase64,
      classification.document_type,
      fileId,
      extractModel
    );
  }

  // LlamaParse fallback
  if (
    isLlamaParseAvailable() &&
    !assessTableQuality(extractedData, classification.document_type)
  ) {
    try {
      const llamaResult = await parseWithLlamaParse(pdfBase64, fileName);
      if (llamaResult.tables.length > 0) {
        extractedData = await extractDocumentData(
          fileId ? null : pdfBase64,
          classification.document_type,
          fileId,
          extractModel
        );
      }
    } catch (err) {
      console.warn("LlamaParse fallback failed:", err);
    }
  }

  controller.enqueue(
    encoder.encode(
      sseEncode({ type: "extraction", data: extractedData })
    )
  );

  // Stage 3: Generate memo
  controller.enqueue(
    encoder.encode(sseEncode({ type: "stage", stage: "generating" }))
  );

  const generateModel = selectModel({
    stage: "generate",
    documentType: classification.document_type,
    dealSubType,
    memoFormat,
  });

  const anthropicStream = streamMemoGeneration(
    extractedData,
    classification.document_type,
    dealSubType,
    memoFormat,
    fileId ? null : pdfBase64,
    fileId,
    generateModel
  );
  let fullMemoText = "";

  const streamResponse = await anthropicStream;
  for await (const event of streamResponse) {
    if (
      event.type === "content_block_delta" &&
      event.delta.type === "text_delta"
    ) {
      const text = event.delta.text;
      fullMemoText += text;
      controller.enqueue(
        encoder.encode(sseEncode({ type: "memo_chunk", text }))
      );
    }
  }

  // Parse memo and derive metrics
  const memoData = buildMemoData(
    fullMemoText,
    extractedData,
    classification.document_type
  );

  // Run verification on critical sections
  const criticalSections = [
    "executive_summary",
    "financial_overview",
    "valuation_context",
  ];
  const verificationPromises = memoData.sections
    .filter((s) => criticalSections.includes(s.id))
    .map(async (section) => {
      try {
        const result = await verifyMemoSection(
          section.content,
          extractedData,
          section.id
        );
        return { sectionId: section.id, flags: result.flags };
      } catch {
        return { sectionId: section.id, flags: [] };
      }
    });

  const verificationResults = await Promise.all(verificationPromises);
  for (const vr of verificationResults) {
    if (vr.flags.length > 0) {
      const section = memoData.sections.find(
        (s) => s.id === vr.sectionId
      );
      if (section) {
        section.verification_flags = vr.flags;
      }
    }
  }

  // Compute financial models
  memoData.financialModels = buildFinancialModels(
    extractedData,
    classification.document_type,
    dealSubType
  );

  // Save to database
  const saved = await prisma.dealMemo.create({
    data: {
      userId,
      documentName: fileName,
      documentType: classification.document_type,
      dealSubType,
      memoFormat,
      anthropicFileId: fileId,
      classification: classification as object,
      extractedData: extractedData as object,
      memoContent: memoData as object,
    },
  });

  // Complete
  controller.enqueue(
    encoder.encode(sseEncode({ type: "stage", stage: "complete" }))
  );
  controller.enqueue(
    encoder.encode(
      sseEncode({
        type: "memo_complete",
        memo_id: saved.id,
        memo: memoData,
      })
    )
  );
}

// ── Multi-document processing pipeline ──

async function processMultiDoc(
  controller: ReadableStreamDefaultController,
  encoder: TextEncoder,
  files: ParsedFile[],
  memoFormat: MemoFormat,
  userId: string
) {
  // Stage 1: Classify all documents
  controller.enqueue(
    encoder.encode(sseEncode({ type: "stage", stage: "classifying" }))
  );

  const classifyModel = selectModel({ stage: "classify" });
  const docResults: Array<{
    fileName: string;
    fileSize: number;
    fileId: string | null;
    classification: ClassificationResult;
    extractedData: ExtractedData;
  }> = [];

  for (const file of files) {
    let fileId: string | null = null;
    try {
      fileId = await uploadPdf(file.pdfBase64, file.fileName);
    } catch {
      // Fall back to base64
    }

    const classification = await classifyDocument(
      fileId ? null : file.pdfBase64,
      fileId,
      classifyModel
    );

    docResults.push({
      fileName: file.fileName,
      fileSize: file.fileSize,
      fileId,
      classification,
      extractedData: null as unknown as ExtractedData, // filled next
    });
  }

  // Send first classification result to UI
  controller.enqueue(
    encoder.encode(
      sseEncode({ type: "classification", result: docResults[0].classification })
    )
  );

  // Stage 2: Extract data from each document
  controller.enqueue(
    encoder.encode(sseEncode({ type: "stage", stage: "extracting" }))
  );

  for (let i = 0; i < docResults.length; i++) {
    const doc = docResults[i];
    const file = files[i];

    const extractModel = selectModel({
      stage: "extract",
      documentType: doc.classification.document_type,
      memoFormat,
      documentCount: files.length,
    });

    doc.extractedData = await extractDocumentData(
      doc.fileId ? null : file.pdfBase64,
      doc.classification.document_type,
      doc.fileId,
      extractModel
    );
  }

  // Build multi-doc context
  const multiDocContext: MultiDocContext = {
    documents: docResults.map((d) => ({
      fileName: d.fileName,
      documentType: d.classification.document_type,
      extractedData: d.extractedData,
    })),
  };

  // Identify primary documents by type
  for (const d of multiDocContext.documents) {
    if (d.documentType === "cim" && !multiDocContext.primaryCIM) {
      multiDocContext.primaryCIM = d.extractedData as import("@/types").CIMData;
    } else if (d.documentType === "term_sheet" && !multiDocContext.termSheet) {
      multiDocContext.termSheet = d.extractedData as import("@/types").TermSheetData;
    } else if (d.documentType === "financial_statement" && !multiDocContext.financials) {
      multiDocContext.financials = d.extractedData as import("@/types").FinancialData;
    }
  }

  // Determine deal sub-type from the primary CIM or first document
  const primaryClassification = docResults.find(
    (d) => d.classification.document_type === "cim"
  )?.classification ?? docResults[0].classification;
  const dealSubType: DealSubType = primaryClassification.deal_sub_type ?? "unknown";

  controller.enqueue(
    encoder.encode(
      sseEncode({ type: "extraction", data: multiDocContext.documents[0].extractedData })
    )
  );

  // Stage 3: Generate unified memo using Opus for multi-doc
  controller.enqueue(
    encoder.encode(sseEncode({ type: "stage", stage: "generating" }))
  );

  const generateModel = selectModel({
    stage: "generate",
    documentType: primaryClassification.document_type,
    dealSubType,
    memoFormat,
    documentCount: files.length,
  });

  const fileIds = docResults
    .map((d) => d.fileId)
    .filter((id): id is string => id != null);

  const anthropicStream = streamMultiDocMemoGeneration(
    multiDocContext,
    dealSubType,
    memoFormat,
    fileIds,
    generateModel
  );
  let fullMemoText = "";

  const streamResponse = await anthropicStream;
  for await (const event of streamResponse) {
    if (
      event.type === "content_block_delta" &&
      event.delta.type === "text_delta"
    ) {
      const text = event.delta.text;
      fullMemoText += text;
      controller.enqueue(
        encoder.encode(sseEncode({ type: "memo_chunk", text }))
      );
    }
  }

  // Use the primary CIM extraction for memo parsing, or fall back to first doc
  const primaryExtraction = multiDocContext.primaryCIM
    ? (multiDocContext.primaryCIM as unknown as ExtractedData)
    : multiDocContext.documents[0].extractedData;

  const memoData = buildMemoData(
    fullMemoText,
    primaryExtraction,
    primaryClassification.document_type
  );

  // Compute financial models
  memoData.financialModels = buildFinancialModels(
    primaryExtraction,
    primaryClassification.document_type,
    dealSubType
  );

  // Save memo with source documents
  const documentNames = docResults.map((d) => d.fileName).join(", ");
  const saved = await prisma.dealMemo.create({
    data: {
      userId,
      documentName: documentNames,
      documentType: primaryClassification.document_type,
      dealSubType,
      memoFormat,
      classification: primaryClassification as object,
      extractedData: primaryExtraction as object,
      memoContent: memoData as object,
      sourceDocuments: {
        create: docResults.map((d) => ({
          fileName: d.fileName,
          documentType: d.classification.document_type,
          anthropicFileId: d.fileId,
          classification: d.classification as object,
          extractedData: d.extractedData as object,
          fileSize: d.fileSize,
        })),
      },
    },
  });

  // Complete
  controller.enqueue(
    encoder.encode(sseEncode({ type: "stage", stage: "complete" }))
  );
  controller.enqueue(
    encoder.encode(
      sseEncode({
        type: "memo_complete",
        memo_id: saved.id,
        memo: memoData,
      })
    )
  );
}
