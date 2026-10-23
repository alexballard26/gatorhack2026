import { GoogleGenAI } from "@google/genai";
import type { Source } from "../types";
import { AiError, apiKey, flashModelChain } from "./config";
import { assertBudget, flashCost, GROUNDING_PER_REQUEST, record } from "./spend";

let client: GoogleGenAI | null = null;
function getClient() {
  const key = apiKey();
  if (!key) throw new AiError("GEMINI_API_KEY is not set (add it to the repo-root .env, or set MOCK_AI=1).", 503);
  if (!client) client = new GoogleGenAI({ apiKey: key });
  return client;
}

export interface FlashResult {
  text: string;
  /** Grounding sources (deduped), in groundingChunk order so indexes are stable. */
  sources: Source[];
  model: string;
}

let workingModel: string | null = null;
const isNotFound = (e: unknown) => {
  const m = String((e as { message?: string })?.message ?? e);
  return /404|NOT_FOUND|not found|not supported/i.test(m);
};

/** Pre-call worst-case estimate used for the budget check. */
const PRE_CALL_ESTIMATE = 0.15;

/**
 * One Flash call, optionally with Google Search grounding. Budget-checked before, recorded after.
 * Model-not-found errors (free) fall through the model chain; any other error is thrown with no retry.
 */
export async function flash(prompt: string, opts: { grounded?: boolean; note: string; json?: boolean }): Promise<FlashResult> {
  await assertBudget(PRE_CALL_ESTIMATE);
  const ai = getClient();
  const chain = workingModel ? [workingModel] : flashModelChain();
  let lastErr: unknown;
  for (const model of chain) {
    try {
      const res = await ai.models.generateContent({
        model,
        contents: prompt,
        config: {
          temperature: 0.2,
          ...(opts.grounded ? { tools: [{ googleSearch: {} }] } : {}),
          // JSON mime type is only requested for ungrounded calls; grounding + JSON mode may not combine.
          ...(opts.json && !opts.grounded ? { responseMimeType: "application/json" } : {}),
        },
      });
      workingModel = model;
      const u = res.usageMetadata;
      const inTok = u?.promptTokenCount ?? Math.ceil(prompt.length / 4);
      const outTok = (u?.candidatesTokenCount ?? 0) + (u?.thoughtsTokenCount ?? 0) + (u?.toolUsePromptTokenCount ?? 0);
      await record("flash", flashCost(inTok, outTok), `${opts.note} [${model}] in=${inTok} out=${outTok}`);
      if (opts.grounded) await record("grounding", GROUNDING_PER_REQUEST, `${opts.note} [${model}]`);

      const gm = res.candidates?.[0]?.groundingMetadata;
      const sources: Source[] = [];
      for (const ch of gm?.groundingChunks ?? []) {
        const w = ch.web;
        sources.push({ title: w?.title || w?.domain || w?.uri || "source", url: w?.uri || "" });
      }
      return { text: res.text ?? "", sources: sources.filter((s) => s.url), model };
    } catch (e) {
      lastErr = e;
      if (isNotFound(e) && chain.length > 1 && model !== chain[chain.length - 1]) continue;
      break;
    }
  }
  if (lastErr instanceof AiError) throw lastErr;
  throw new AiError(`Gemini call failed: ${String((lastErr as { message?: string })?.message ?? lastErr).slice(0, 400)}`);
}

/** Extract the first JSON value from model text (handles code fences / prose around it). */
export function parseJson<T = unknown>(text: string): T {
  let t = text.trim();
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) t = fence[1].trim();
  const start = t.search(/[[{]/);
  if (start > 0) t = t.slice(start);
  const end = Math.max(t.lastIndexOf("]"), t.lastIndexOf("}"));
  if (end >= 0) t = t.slice(0, end + 1);
  return JSON.parse(t) as T;
}

/** Flash + parse + validate, with exactly one retry (a second paid call) on parse/validation failure. */
export async function flashJson<T>(
  prompt: string,
  opts: { grounded?: boolean; note: string },
  validate: (raw: unknown) => T,
): Promise<{ value: T; sources: Source[]; model: string }> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    const p = attempt === 0 ? prompt : `${prompt}\n\nYour previous reply could not be parsed (${String((lastErr as Error)?.message).slice(0, 200)}). Reply again with ONLY the valid JSON, no prose, no code fences.`;
    const r = await flash(p, { ...opts, json: true });
    try {
      return { value: validate(parseJson(r.text)), sources: r.sources, model: r.model };
    } catch (e) {
      lastErr = e;
    }
  }
  throw new AiError(`Model returned invalid JSON twice: ${String((lastErr as Error)?.message).slice(0, 200)}`);
}
