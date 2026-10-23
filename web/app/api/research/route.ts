import { NextRequest, NextResponse } from "next/server";
import { errorResponse } from "@/lib/ai/http";
import { pollResearch, startResearch } from "@/lib/ai/research";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const raceId = req.nextUrl.searchParams.get("raceId");
  if (!raceId) return NextResponse.json({ error: "raceId is required" }, { status: 400 });
  try {
    return NextResponse.json(await pollResearch(raceId));
  } catch (e) {
    return errorResponse(e);
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const raceId = typeof body?.raceId === "string" ? body.raceId : "";
  if (!raceId) return NextResponse.json({ error: "raceId is required" }, { status: 400 });
  try {
    return NextResponse.json(await startResearch(raceId));
  } catch (e) {
    return errorResponse(e);
  }
}
