import { NextRequest, NextResponse } from "next/server";
import type { VoterLocation } from "@/lib/types";
import { getBallot } from "@/lib/ai/ballot";
import { errorResponse } from "@/lib/ai/http";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  const state = p.get("state")?.trim().toUpperCase();
  if (!state || !/^[A-Z]{2}$/.test(state)) return NextResponse.json({ error: "state (2-letter) is required" }, { status: 400 });
  const loc: VoterLocation = {
    state,
    county: p.get("county")?.trim().replace(/\s+county$/i, "") || undefined,
    congressionalDistrict: p.get("cd")?.trim() || undefined,
    stateSenateDistrict: p.get("sd")?.trim() || undefined,
    stateHouseDistrict: p.get("hd")?.trim() || undefined,
    place: p.get("place")?.trim() || undefined,
    method: "manual",
  };
  try {
    return NextResponse.json(await getBallot(loc));
  } catch (e) {
    return errorResponse(e);
  }
}
