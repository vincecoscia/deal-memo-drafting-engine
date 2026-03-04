export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import {
  classifyDocument,
  extractDocumentData,
  extractCIMChunked,
  streamMemoGeneration,
  uploadPdf,
  verifyMemoSection,
} from "@/lib/claude";
import { buildMemoData } from "@/lib/memo-parser";
import type { SSEEvent, MemoFormat, DealSubType } from "@/types";

// Size threshold for chunked extraction (~100+ pages)
const CHUNKED_EXTRACTION_THRESHOLD = 5 * 1024 * 1024;

function sseEncode(data: SSEEvent): string {
  return `data: ${JSON.stringify(data)}\n\n`;
}

export async function POST(request: Request): Promise<Response> {
  // Auth check
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return new Response("Unauthorized", { status: 401 });
  }

  // Parse file
  let pdfBase64: string;
  let fileName: string;
  let fileSize: number;
  let memoFormat: MemoFormat = "standard";

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    if (!file) return new Response("No file provided", { status: 400 });
    if (file.type !== "application/pdf")
      return new Response("Only PDF files are accepted", { status: 400 });
    if (file.size > 32 * 1024 * 1024)
      return new Response("File exceeds 32MB limit", { status: 413 });

    const arrayBuffer = await file.arrayBuffer();
    pdfBase64 = Buffer.from(arrayBuffer).toString("base64");
    fileName = file.name;
    fileSize = file.size;

    // Optional memo format from form data
    const formatParam = formData.get("memo_format") as string | null;
    if (
      formatParam === "concise" ||
      formatParam === "standard" ||
      formatParam === "detailed"
    ) {
      memoFormat = formatParam;
    }
  } catch {
    return new Response("Failed to parse upload", { status: 400 });
  }

  const userId = session.user.id;
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      let fileId: string | null = null;

      try {
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
        const classification = await classifyDocument(
          fileId ? null : pdfBase64,
          fileId
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

        let extractedData;
        if (
          classification.document_type === "cim" &&
          fileSize > CHUNKED_EXTRACTION_THRESHOLD
        ) {
          extractedData = await extractCIMChunked(
            fileId ? null : pdfBase64,
            fileId
          );
        } else {
          extractedData = await extractDocumentData(
            fileId ? null : pdfBase64,
            classification.document_type,
            fileId
          );
        }

        controller.enqueue(
          encoder.encode(
            sseEncode({ type: "extraction", data: extractedData })
          )
        );

        // Stage 3: Generate memo (streaming) with PDF pass-through
        controller.enqueue(
          encoder.encode(sseEncode({ type: "stage", stage: "generating" }))
        );

        const anthropicStream = streamMemoGeneration(
          extractedData,
          classification.document_type,
          dealSubType,
          memoFormat,
          fileId ? null : pdfBase64,
          fileId
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
