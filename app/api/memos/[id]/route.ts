export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import type { DealMemoData } from "@/types";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return new Response("Unauthorized", { status: 401 });

  const { id } = await params;
  const body = await request.json();
  const { section_id, content, confidence_score } = body as {
    section_id: string;
    content: string;
    confidence_score: number;
  };

  if (!section_id || typeof content !== "string") {
    return new Response("Invalid request body", { status: 400 });
  }

  const memo = await prisma.dealMemo.findUnique({ where: { id } });
  if (!memo || memo.userId !== session.user.id) {
    return new Response("Not found", { status: 404 });
  }

  const memoContent = memo.memoContent as unknown as DealMemoData;
  const updatedSections = memoContent.sections.map((s) =>
    s.id === section_id
      ? { ...s, content, confidence_score: confidence_score ?? s.confidence_score }
      : s
  );

  await prisma.dealMemo.update({
    where: { id },
    data: {
      memoContent: JSON.parse(
        JSON.stringify({ ...memoContent, sections: updatedSections })
      ),
    },
  });

  return Response.json({ success: true });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return new Response("Unauthorized", { status: 401 });

  const { id } = await params;

  const memo = await prisma.dealMemo.findUnique({ where: { id } });
  if (!memo || memo.userId !== session.user.id) {
    return new Response("Not found", { status: 404 });
  }

  await prisma.dealMemo.delete({ where: { id } });

  return Response.json({ success: true });
}
