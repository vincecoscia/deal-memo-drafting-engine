export const runtime = "nodejs";

import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { scoreInvestment } from "@/lib/claude";
import type { ExtractedData, DocumentType, DealSubType } from "@/types";

export async function POST(request: Request): Promise<Response> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return new Response("Unauthorized", { status: 401 });

  const { memo_id } = (await request.json()) as { memo_id: string };

  const memo = await prisma.dealMemo.findUnique({ where: { id: memo_id } });
  if (!memo || memo.userId !== session.user.id) {
    return new Response("Not found", { status: 404 });
  }

  const extractedData = memo.extractedData as unknown as ExtractedData;
  const documentType = memo.documentType as DocumentType;
  const dealSubType = ((memo as Record<string, unknown>).dealSubType as DealSubType) ?? "unknown";

  const scorecard = await scoreInvestment(extractedData, documentType, dealSubType);

  return Response.json(scorecard);
}
