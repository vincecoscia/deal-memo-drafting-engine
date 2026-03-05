export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { fetchFilingContent } from "@/lib/edgar";
import {
  classifyDocument,
  extractDocumentData,
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

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return new Response("Unauthorized", { status: 401 });

  const body = await request.json();
  const { memoId, documentUrl, companyName, formType } = body as {
    memoId: string;
    documentUrl: string;
    companyName: string;
    formType: string;
  };

  if (!memoId || !documentUrl) {
    return new Response("Missing required fields", { status: 400 });
  }

  // Verify memo ownership
  const memo = await prisma.dealMemo.findUnique({
    where: { id: memoId },
    include: { sourceDocuments: true },
  });

  if (!memo || memo.userId !== session.user.id) {
    return new Response("Not found", { status: 404 });
  }

  try {
    // Fetch the filing content (HTML → text)
    const filingText = await fetchFilingContent(documentUrl);

    if (!filingText || filingText.length < 100) {
      return new Response("Could not extract filing content", { status: 422 });
    }

    // Truncate to ~100k chars to stay within Claude's context limits
    const truncatedText = filingText.slice(0, 100_000);

    // Classify the filing using text content
    const classifyModel = selectModel({ stage: "classify" });
    const classification = await classifyDocument(
      null, // no PDF base64
      null, // no file ID
      classifyModel,
      truncatedText // pass as text content
    );

    // Extract data from the filing text
    const extractModel = selectModel({
      stage: "extract",
      documentType: classification.document_type,
      documentCount: memo.sourceDocuments.length + 1,
    });

    const extractedData = await extractDocumentData(
      null,
      classification.document_type,
      null,
      extractModel,
      truncatedText
    );

    // Save as source document
    const fileName = `${companyName} - ${formType} (SEC Filing)`;
    const sourceDoc = await prisma.sourceDocument.create({
      data: {
        memoId,
        fileName,
        documentType: classification.document_type,
        classification: classification as object,
        extractedData: extractedData as object,
      },
    });

    // If the original memo doesn't have source documents yet, create one for the original
    if (memo.sourceDocuments.length === 0) {
      await prisma.sourceDocument.create({
        data: {
          memoId,
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
      where: { memoId },
    });

    const multiDocContext: MultiDocContext = {
      documents: allSourceDocs.map((d) => ({
        fileName: d.fileName,
        documentType: d.documentType as "cim" | "term_sheet" | "financial_statement",
        extractedData: d.extractedData as unknown as ExtractedData,
      })),
    };

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
    const primaryClassification = memo.classification as unknown as ClassificationResult;
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
      where: { id: memoId },
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
  } catch (err) {
    console.error("EDGAR import error:", err);
    return new Response(
      `Failed to import filing: ${err instanceof Error ? err.message : "Unknown error"}`,
      { status: 500 }
    );
  }
}
