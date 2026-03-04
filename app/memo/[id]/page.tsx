export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect, notFound } from "next/navigation";
import type {
  DealMemoData,
  ExtractedData,
  ClassificationResult,
} from "@/types";
import { MemoViewerClient } from "./client";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function MemoPage({ params }: Props) {
  const { id } = await params;

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/sign-in");

  const memo = await prisma.dealMemo.findUnique({ where: { id } });
  if (!memo || memo.userId !== session.user.id) notFound();

  const memoData = memo.memoContent as unknown as DealMemoData;
  const extractedData = memo.extractedData as unknown as ExtractedData;
  const classification = memo.classification as unknown as ClassificationResult;

  return (
    <MemoViewerClient
      memoId={memo.id}
      memoData={memoData}
      extractedData={extractedData}
      classification={classification}
      documentName={memo.documentName}
      documentType={memo.documentType}
    />
  );
}
