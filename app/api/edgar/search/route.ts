export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { searchEdgar } from "@/lib/edgar";

export async function GET(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return new Response("Unauthorized", { status: 401 });

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q");
  const formType = searchParams.get("type") ?? undefined;
  const dateFrom = searchParams.get("from") ?? undefined;
  const dateTo = searchParams.get("to") ?? undefined;

  if (!q) {
    return new Response("Missing query parameter 'q'", { status: 400 });
  }

  try {
    const results = await searchEdgar(q, formType, dateFrom, dateTo, 15);
    return Response.json(results);
  } catch (err) {
    console.error("EDGAR search error:", err);
    return new Response("EDGAR search failed", { status: 502 });
  }
}
