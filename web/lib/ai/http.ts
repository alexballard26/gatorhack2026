import { NextResponse } from "next/server";
import { AiError } from "./config";

export function errorResponse(e: unknown) {
  if (e instanceof AiError) return NextResponse.json({ error: e.message, ...(e.status === 402 ? { status: "budget-blocked" } : {}) }, { status: e.status });
  console.error(e);
  return NextResponse.json({ error: String((e as Error)?.message ?? e).slice(0, 300) }, { status: 500 });
}
