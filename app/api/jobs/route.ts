export const runtime = "nodejs";

import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";

export async function GET(): Promise<Response> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return new Response("Unauthorized", { status: 401 });

  const jobs = await prisma.processingJob.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  return Response.json(jobs);
}
