import { prisma } from "@/lib/prisma";
import {
  classifyDocument,
  extractDocumentData,
  extractCIMChunked,
  extractDocumentByPageChunks,
  streamMemoGeneration,
  uploadPdf,
  verifyMemoSection,
} from "@/lib/claude";
import { selectModel } from "@/lib/model-selector";
import { getPdfPageCount, splitPdfByPageRanges } from "@/lib/pdf-utils";
import {
  isLlamaParseAvailable,
  assessTableQuality,
  parseWithLlamaParse,
} from "@/lib/llamaparse";
import { buildMemoData } from "@/lib/memo-parser";
import type { MemoFormat, DealSubType } from "@/types";

const CHUNKED_EXTRACTION_THRESHOLD = 5 * 1024 * 1024;

async function updateJobProgress(
  jobId: string,
  status: string,
  progress?: { stage: string; message: string }
) {
  await prisma.processingJob.update({
    where: { id: jobId },
    data: {
      status,
      ...(progress ? { progress: progress as object } : {}),
    },
  });
}

export async function processJob(
  jobId: string,
  pdfBase64: string,
  fileName: string,
  fileSize: number,
  memoFormat: MemoFormat,
  userId: string
): Promise<void> {
  try {
    // Upload to Files API
    let fileId: string | null = null;
    try {
      fileId = await uploadPdf(pdfBase64, fileName);
      await prisma.processingJob.update({
        where: { id: jobId },
        data: { anthropicFileId: fileId },
      });
    } catch (err) {
      console.warn("Files API upload failed, falling back to base64:", err);
    }

    // Stage 1: Classify
    await updateJobProgress(jobId, "classifying", {
      stage: "classifying",
      message: "Classifying document type...",
    });

    const classifyModel = selectModel({ stage: "classify" });
    const classification = await classifyDocument(
      fileId ? null : pdfBase64,
      fileId,
      classifyModel
    );

    await prisma.processingJob.update({
      where: { id: jobId },
      data: { classificationResult: classification as object },
    });

    const dealSubType: DealSubType =
      classification.deal_sub_type ?? "unknown";

    // Stage 2: Extract
    await updateJobProgress(jobId, "extracting", {
      stage: "extracting",
      message: "Extracting structured data...",
    });

    let pageCount = 0;
    try {
      pageCount = await getPdfPageCount(pdfBase64);
      await prisma.processingJob.update({
        where: { id: jobId },
        data: { pageCount },
      });
    } catch {
      // Continue without page count
    }

    const extractModel = selectModel({
      stage: "extract",
      documentType: classification.document_type,
      memoFormat,
      pageCount,
    });

    let extractedData;
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

    await prisma.processingJob.update({
      where: { id: jobId },
      data: { extractedData: extractedData as object },
    });

    // Stage 3: Generate memo (non-streaming for background processing)
    await updateJobProgress(jobId, "generating", {
      stage: "generating",
      message: "Generating deal memo...",
    });

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
        fullMemoText += event.delta.text;
      }
    }

    // Parse and verify
    const memoData = buildMemoData(
      fullMemoText,
      extractedData,
      classification.document_type
    );

    await updateJobProgress(jobId, "verifying", {
      stage: "verifying",
      message: "Verifying critical sections...",
    });

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
        const section = memoData.sections.find((s) => s.id === vr.sectionId);
        if (section) {
          section.verification_flags = vr.flags;
        }
      }
    }

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

    // Mark job complete
    await prisma.processingJob.update({
      where: { id: jobId },
      data: {
        status: "complete",
        memoId: saved.id,
        progress: { stage: "complete", message: "Analysis complete" } as object,
      },
    });
  } catch (error) {
    console.error("Job processing error:", error);
    await prisma.processingJob.update({
      where: { id: jobId },
      data: {
        status: "failed",
        errorMsg: error instanceof Error ? error.message : "Processing failed",
      },
    });
  }
}
