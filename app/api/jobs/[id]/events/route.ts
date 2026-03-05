export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { id: jobId } = await params;
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      let lastStatus = "";
      const maxPolls = 120; // 4 minutes max (2s intervals)

      for (let i = 0; i < maxPolls; i++) {
        try {
          const job = await prisma.processingJob.findUnique({
            where: { id: jobId },
          });

          if (!job || job.userId !== session.user.id) {
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ type: "error", message: "Job not found" })}\n\n`
              )
            );
            break;
          }

          if (job.status !== lastStatus) {
            lastStatus = job.status;
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({
                  type: "progress",
                  status: job.status,
                  progress: job.progress,
                  memoId: job.memoId,
                })}\n\n`
              )
            );
          }

          if (job.status === "complete" || job.status === "failed") {
            break;
          }

          await new Promise((resolve) => setTimeout(resolve, 2000));
        } catch {
          break;
        }
      }

      controller.close();
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
