import { NextRequest, NextResponse } from "next/server";
import { ask } from "@/lib/ai/ask";
import { errorResponse } from "@/lib/ai/http";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  try {
    return NextResponse.json(await ask({ raceId: body?.raceId, candidateId: body?.candidateId, question: body?.question }));
  } catch (e) {
    return errorResponse(e);
  }
}
