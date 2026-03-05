export const runtime = "nodejs";

import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { generateLBOExcel, generateDCFExcel } from "@/lib/financial-models/excel-generator";
import type { DealMemoData } from "@/types";

export async function GET(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const memoId = searchParams.get("memo_id");
  const modelType = searchParams.get("model_type"); // "lbo" | "dcf"

  if (!memoId || !modelType) {
    return new Response("Missing memo_id or model_type", { status: 400 });
  }

  const memo = await prisma.dealMemo.findUnique({
    where: { id: memoId },
    select: { userId: true, memoContent: true, documentName: true },
  });

  if (!memo || memo.userId !== session.user.id) {
    return new Response("Not found", { status: 404 });
  }

  const memoData = memo.memoContent as unknown as DealMemoData;
  const models = memoData.financialModels;

  if (!models) {
    return new Response("No financial models available", { status: 404 });
  }

  let buffer: Buffer;
  let filename: string;
  const baseName = memo.documentName.replace(/\.pdf$/i, "");

  if (modelType === "lbo" && models.lbo) {
    buffer = await generateLBOExcel(models.lbo.inputs, models.lbo.outputs);
    filename = `${baseName}_LBO_Model.xlsx`;
  } else if (modelType === "dcf" && models.dcf) {
    buffer = await generateDCFExcel(models.dcf.inputs, models.dcf.outputs);
    filename = `${baseName}_DCF_Model.xlsx`;
  } else {
    return new Response("Model type not available", { status: 404 });
  }

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
