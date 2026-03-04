export const runtime = "nodejs";

import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { generateDocx } from "@/lib/export";
import type { DealMemoData } from "@/types";

export async function POST(request: Request): Promise<Response> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return new Response("Unauthorized", { status: 401 });

  const { memo_id } = (await request.json()) as { memo_id: string };

  const memo = await prisma.dealMemo.findUnique({ where: { id: memo_id } });
  if (!memo || memo.userId !== session.user.id) {
    return new Response("Not found", { status: 404 });
  }

  const memoData = memo.memoContent as unknown as DealMemoData;
  const buffer = await generateDocx(memoData, memo.documentName);

  const companyName =
    memoData.metrics.company_name?.replace(/[^a-zA-Z0-9]/g, "_") ?? "export";

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="deal-memo-${companyName}.docx"`,
    },
  });
}
