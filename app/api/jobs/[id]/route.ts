export const runtime = "nodejs";

import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return new Response("Unauthorized", { status: 401 });

  const { id } = await params;

  const job = await prisma.processingJob.findUnique({ where: { id } });
  if (!job || job.userId !== session.user.id) {
    return new Response("Not found", { status: 404 });
  }

  return Response.json(job);
}
