export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import {
  classifyDocument,
  extractDocumentData,
  uploadPdf,
  streamMultiDocMemoGeneration,
  verifyMemoSection,
} from "@/lib/claude";
import { selectModel } from "@/lib/model-selector";
import { buildMemoData } from "@/lib/memo-parser";
import type {
  DealSubType,
  MemoFormat,
  MultiDocContext,
  ExtractedData,
  ClassificationResult,
  CIMData,
  TermSheetData,
  FinancialData,
} from "@/types";

interface Props {
  params: Promise<{ id: string }>;
}

// POST — Add a document to an existing memo and regenerate
export async function POST(request: Request, { params }: Props) {
  const { id } = await params;

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return new Response("Unauthorized", { status: 401 });
  }

  const memo = await prisma.dealMemo.findUnique({
    where: { id },
    include: { sourceDocuments: true },
  });

  if (!memo || memo.userId !== session.user.id) {
    return new Response("Not found", { status: 404 });
  }

  // Parse the uploaded file
  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  if (!file) return new Response("No file provided", { status: 400 });
  if (file.type !== "application/pdf")
    return new Response("Only PDF files are accepted", { status: 400 });
  if (file.size > 32 * 1024 * 1024)
    return new Response("File exceeds 32MB limit", { status: 413 });

  const arrayBuffer = await file.arrayBuffer();
  const pdfBase64 = Buffer.from(arrayBuffer).toString("base64");

  // Upload to Files API
  let fileId: string | null = null;
  try {
    fileId = await uploadPdf(pdfBase64, file.name);
  } catch {
    // Fall back to base64
  }

  // Classify & extract the new document
  const classifyModel = selectModel({ stage: "classify" });
  const classification = await classifyDocument(
    fileId ? null : pdfBase64,
    fileId,
    classifyModel
  );

  const extractModel = selectModel({
    stage: "extract",
    documentType: classification.document_type,
    documentCount: memo.sourceDocuments.length + 1,
  });

  const extractedData = await extractDocumentData(
    fileId ? null : pdfBase64,
    classification.document_type,
    fileId,
    extractModel
  );

  // Save as source document
  const sourceDoc = await prisma.sourceDocument.create({
    data: {
      memoId: id,
      fileName: file.name,
      documentType: classification.document_type,
      anthropicFileId: fileId,
      classification: classification as object,
      extractedData: extractedData as object,
      fileSize: file.size,
    },
  });

  // If the original memo doesn't have source documents yet, create one for the original
  if (memo.sourceDocuments.length === 0) {
    await prisma.sourceDocument.create({
      data: {
        memoId: id,
        fileName: memo.documentName,
        documentType: memo.documentType,
        anthropicFileId: memo.anthropicFileId,
        classification: memo.classification as object,
        extractedData: memo.extractedData as object,
      },
    });
  }

  // Build multi-doc context from all source documents
  const allSourceDocs = await prisma.sourceDocument.findMany({
    where: { memoId: id },
  });

  const multiDocContext: MultiDocContext = {
    documents: allSourceDocs.map((d) => ({
      fileName: d.fileName,
      documentType: d.documentType as "cim" | "term_sheet" | "financial_statement",
      extractedData: d.extractedData as unknown as ExtractedData,
    })),
  };

  // Identify primary documents
  for (const d of multiDocContext.documents) {
    if (d.documentType === "cim" && !multiDocContext.primaryCIM) {
      multiDocContext.primaryCIM = d.extractedData as CIMData;
    } else if (d.documentType === "term_sheet" && !multiDocContext.termSheet) {
      multiDocContext.termSheet = d.extractedData as TermSheetData;
    } else if (d.documentType === "financial_statement" && !multiDocContext.financials) {
      multiDocContext.financials = d.extractedData as FinancialData;
    }
  }

  const memoFormat = (memo.memoFormat ?? "standard") as MemoFormat;
  const primaryClassification = (memo.classification as unknown as ClassificationResult);
  const dealSubType: DealSubType = primaryClassification.deal_sub_type ?? "unknown";

  // Regenerate memo with all documents
  const generateModel = selectModel({
    stage: "generate",
    documentType: primaryClassification.document_type,
    dealSubType,
    memoFormat,
    documentCount: allSourceDocs.length,
  });

  const fileIds = allSourceDocs
    .map((d) => d.anthropicFileId)
    .filter((fid): fid is string => fid != null);

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
      fullMemoText += event.delta.text;
    }
  }

  const primaryExtraction = multiDocContext.primaryCIM
    ? (multiDocContext.primaryCIM as unknown as ExtractedData)
    : multiDocContext.documents[0].extractedData;

  const memoData = buildMemoData(
    fullMemoText,
    primaryExtraction,
    primaryClassification.document_type
  );

  // Verify critical sections
  const criticalSections = ["executive_summary", "financial_overview", "valuation_context"];
  const verificationPromises = memoData.sections
    .filter((s) => criticalSections.includes(s.id))
    .map(async (section) => {
      try {
        const result = await verifyMemoSection(
          section.content,
          primaryExtraction,
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

  // Update the memo
  const documentNames = allSourceDocs.map((d) => d.fileName).join(", ");
  await prisma.dealMemo.update({
    where: { id },
    data: {
      documentName: documentNames,
      extractedData: primaryExtraction as object,
      memoContent: memoData as object,
    },
  });

  return Response.json({
    sourceDocument: {
      id: sourceDoc.id,
      fileName: sourceDoc.fileName,
      documentType: sourceDoc.documentType,
      createdAt: sourceDoc.createdAt.toISOString(),
    },
    memo: memoData,
  });
}

// GET — List source documents for a memo
export async function GET(_request: Request, { params }: Props) {
  const { id } = await params;

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return new Response("Unauthorized", { status: 401 });
  }

  const memo = await prisma.dealMemo.findUnique({
    where: { id },
    select: { userId: true },
  });

  if (!memo || memo.userId !== session.user.id) {
    return new Response("Not found", { status: 404 });
  }

  const docs = await prisma.sourceDocument.findMany({
    where: { memoId: id },
    select: {
      id: true,
      fileName: true,
      documentType: true,
      createdAt: true,
      fileSize: true,
    },
    orderBy: { createdAt: "asc" },
  });

  return Response.json(docs);
}
