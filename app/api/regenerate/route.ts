export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { streamSectionRegeneration } from "@/lib/claude";
import { parseSingleSection } from "@/lib/memo-parser";
import type { RegenerateRequest, DealMemoData, ExtractedData, DocumentType, DealSubType, MemoFormat } from "@/types";

export async function POST(request: Request): Promise<Response> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return new Response("Unauthorized", { status: 401 });

  const body = (await request.json()) as RegenerateRequest;
  const { memo_id, section_id } = body;

  // Load memo from DB
  const memo = await prisma.dealMemo.findUnique({ where: { id: memo_id } });
  if (!memo || memo.userId !== session.user.id) {
    return new Response("Not found", { status: 404 });
  }

  const memoContent = memo.memoContent as unknown as DealMemoData;
  const extractedData = memo.extractedData as unknown as ExtractedData;
  const documentType = memo.documentType as DocumentType;
  const dealSubType = ((memo as Record<string, unknown>).dealSubType as DealSubType) ?? "unknown";
  const memoFormat = ((memo as Record<string, unknown>).memoFormat as MemoFormat) ?? "standard";

  const existingSection = memoContent.sections.find((s) => s.id === section_id);
  if (!existingSection) {
    return new Response("Section not found", { status: 404 });
  }

  // Build context from other sections
  const context = memoContent.sections
    .filter((s) => s.id !== section_id)
    .map((s) => `## ${s.title}\n${s.content}`)
    .join("\n\n");

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const anthropicStream = streamSectionRegeneration(
          section_id,
          existingSection.title,
          extractedData,
          documentType,
          context,
          dealSubType,
          memoFormat
        );

        let fullText = "";
        const streamResponse = await anthropicStream;
        for await (const event of streamResponse) {
          if (
            event.type === "content_block_delta" &&
            event.delta.type === "text_delta"
          ) {
            const text = event.delta.text;
            fullText += text;
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ text })}\n\n`)
            );
          }
        }

        // Parse the regenerated section
        const newSection = parseSingleSection(fullText);
        if (newSection) {
          // Update in DB
          const updatedSections = memoContent.sections.map((s) =>
            s.id === section_id ? { ...newSection, id: section_id } : s
          );
          await prisma.dealMemo.update({
            where: { id: memo_id },
            data: {
              memoContent: JSON.parse(JSON.stringify({
                ...memoContent,
                sections: updatedSections,
              })),
            },
          });

          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ done: true, section: newSection })}\n\n`
            )
          );
        }
      } catch (error) {
        console.error("Regeneration error:", error);
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ error: error instanceof Error ? error.message : "Regeneration failed" })}\n\n`
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
