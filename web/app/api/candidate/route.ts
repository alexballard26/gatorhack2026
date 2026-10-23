import { NextRequest, NextResponse } from "next/server";
import { getCandidate } from "@/lib/ai/candidate";
import { errorResponse } from "@/lib/ai/http";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  const raceId = p.get("raceId");
  const candidateId = p.get("candidateId");
  if (!raceId || !candidateId) return NextResponse.json({ error: "raceId and candidateId are required" }, { status: 400 });
  try {
    return NextResponse.json(
      await getCandidate({ raceId, candidateId, name: p.get("name") ?? undefined, party: p.get("party") ?? undefined, raceTitle: p.get("raceTitle") ?? undefined }),
    );
  } catch (e) {
    return errorResponse(e);
  }
}
