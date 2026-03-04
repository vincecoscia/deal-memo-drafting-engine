export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { classifyDocument, extractDocumentData, streamMemoGeneration } from "@/lib/claude";
import { buildMemoData } from "@/lib/memo-parser";
import type { SSEEvent } from "@/types";

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
  } catch {
    return new Response("Failed to parse upload", { status: 400 });
  }

  const userId = session.user.id;
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        // Stage 1: Classify
        controller.enqueue(
          encoder.encode(sseEncode({ type: "stage", stage: "classifying" }))
        );
        const classification = await classifyDocument(pdfBase64);
        controller.enqueue(
          encoder.encode(
            sseEncode({ type: "classification", result: classification })
          )
        );

        // Stage 2: Extract
        controller.enqueue(
          encoder.encode(sseEncode({ type: "stage", stage: "extracting" }))
        );
        const extractedData = await extractDocumentData(
          pdfBase64,
          classification.document_type
        );
        controller.enqueue(
          encoder.encode(sseEncode({ type: "extraction", data: extractedData }))
        );

        // Stage 3: Generate memo (streaming)
        controller.enqueue(
          encoder.encode(sseEncode({ type: "stage", stage: "generating" }))
        );

        const anthropicStream = streamMemoGeneration(
          extractedData,
          classification.document_type
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

        // Save to database
        const saved = await prisma.dealMemo.create({
          data: {
            userId,
            documentName: fileName,
            documentType: classification.document_type,
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
