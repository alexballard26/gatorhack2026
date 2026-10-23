import type { AskResponse } from "../types";
import { AiError, isMock } from "./config";
import { flash } from "./gemini";
import { mockAsk } from "./mock";
import { askPrompt } from "./prompts";
import { findRace } from "./store";

export async function ask(input: { raceId?: string; candidateId?: string; question?: string }): Promise<AskResponse> {
  const question = (input.question ?? "").trim();
  if (!question) throw new AiError("question is required", 400);
  if (question.length > 600) throw new AiError("question too long (600 characters max)", 400);
  if (isMock()) return mockAsk(question);

  const ctx = input.raceId ? await findRace(input.raceId) : null;
  const cand = ctx?.race.candidates.find((c) => c.id === input.candidateId);
  const r = await flash(askPrompt(ctx?.race ?? null, cand?.name, question), { grounded: true, note: `ask ${input.raceId ?? ""}/${input.candidateId ?? ""}` });
  return { answer: r.text.trim() || "No verified information found.", sources: r.sources, model: r.model };
}
