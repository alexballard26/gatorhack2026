import type { ResearchJob, Source } from "../types";
import { cacheGet, cacheSet, once } from "./cache";
import { AiError, apiKey, deepResearchAgent, isMock } from "./config";
import { mockJobAt } from "./mock";
import { researchPrompt } from "./prompts";
import { DEEP_RESEARCH_ESTIMATE, refundDeepResearch, reserveDeepResearch } from "./spend";
import { findRace } from "./store";

/**
 * Gemini Interactions API (REST; @google/genai 1.30.0 has no Interactions support).
 * Docs: https://ai.google.dev/gemini-api/docs/deep-research  and  https://ai.google.dev/api/interactions-api
 *   POST https://generativelanguage.googleapis.com/v1beta/interactions
 *   GET  https://generativelanguage.googleapis.com/v1beta/interactions/{id}
 *   header: x-goog-api-key
 */
const BASE = "https://generativelanguage.googleapis.com/v1beta/interactions";

async function api(method: "GET" | "POST", url: string, body?: unknown) {
  const key = apiKey();
  if (!key) throw new AiError("GEMINI_API_KEY is not set (add it to the repo-root .env, or set MOCK_AI=1).", 503);
  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json", "x-goog-api-key": key },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) throw new AiError(`Interactions API ${res.status}: ${text.slice(0, 500)}`, res.status === 429 ? 429 : 502);
  return JSON.parse(text);
}

type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

const textOf = (v: unknown): string => {
  if (!v) return "";
  if (typeof v === "string") return v;
  if (Array.isArray(v)) return v.map(textOf).filter(Boolean).join("\n");
  if (typeof v === "object") {
    const o = v as Json;
    return textOf(o.text ?? o.summary ?? o.content ?? o.thought ?? "");
  }
  return "";
};

/** Pull report text, citations and thought summaries out of an Interaction resource (defensive: shape is preview). */
export function parseInteraction(it: Json) {
  const steps: Json[] = Array.isArray(it.steps) ? it.steps : [];
  const thoughts: string[] = [];
  const sources: Source[] = [];
  const addSource = (a: Json) => {
    if (a?.url && !sources.some((s) => s.url === a.url)) sources.push({ title: a.title || a.url, url: a.url });
  };
  let report = "";
  for (const s of steps) {
    if (/thought/i.test(String(s.type))) {
      const t = textOf(s.summary ?? s.content ?? s).trim();
      if (t) thoughts.push(t);
    }
  }
  const outputs = [...steps].reverse().find((s) => s.type === "model_output");
  const blocks: Json[] = Array.isArray(outputs?.content) ? outputs!.content : [];
  for (const b of blocks) {
    if (b.type === "text" || typeof b.text === "string") {
      report += b.text ?? "";
      for (const a of b.annotations ?? []) if (a?.type === "url_citation" || a?.url) addSource(a);
    }
  }
  if (!report) report = textOf(it.output_text ?? it.outputs);
  return { report: report.trim(), sources, thoughts };
}

const ACTIVE: ResearchJob["status"][] = ["queued", "running", "completed"];

async function load(raceId: string) {
  return cacheGet<ResearchJob>("research", raceId);
}

/** GET: return the cached job, refreshing from Gemini while it is in progress. */
export async function pollResearch(raceId: string): Promise<ResearchJob> {
  const job = await load(raceId);
  if (!job) return { raceId, status: "not-started", cached: false };
  if (job.status === "completed" || job.status === "failed" || job.status === "budget-blocked") return { ...job, cached: true };

  if (isMock()) {
    const next = mockJobAt(job, (await findRace(raceId))?.race ?? null);
    await cacheSet("research", raceId, next);
    return next;
  }
  if (!job.interactionId) return { ...job, cached: true }; // create call still in flight

  return once(`research-poll:${raceId}`, async () => {
    const it = await api("GET", `${BASE}/${encodeURIComponent(job.interactionId!)}`);
    const { report, sources, thoughts } = parseInteraction(it);
    const progress = [...new Set([...(job.progress ?? []), ...thoughts])];
    let next: ResearchJob = { ...job, progress };
    const st = String(it.status);
    if (st === "completed") {
      next = { ...next, status: "completed", completedAt: new Date().toISOString(), reportMarkdown: report, sources, estimatedCostUsd: DEEP_RESEARCH_ESTIMATE };
      if (!report) next.progress = [...progress, "Completed, but no report text was returned"];
    } else if (["failed", "cancelled", "incomplete"].includes(st)) {
      next = { ...next, status: "failed", error: (it.errors ?? []).map((e: Json) => e.message).join("; ") || `Interaction ${st}` };
    } else {
      next = { ...next, status: "running" };
    }
    await cacheSet("research", raceId, next);
    return { ...next, cached: false };
  });
}

/** POST: start (once) a Deep Research run for the race. Never starts a second run for queued/running/completed. */
export function startResearch(raceId: string): Promise<ResearchJob> {
  return once(`research-start:${raceId}`, async () => {
    const existing = await load(raceId);
    if (existing && ACTIVE.includes(existing.status)) return { ...existing, cached: true };

    const ctx = await findRace(raceId);
    if (!ctx) throw new AiError(`Unknown raceId "${raceId}". Load the ballot (/api/ballot) first.`, 404);
    if (ctx.race.kind !== "candidate" || ctx.race.candidates.length === 0) throw new AiError("Research needs a race with candidates.", 400);

    const startedAt = new Date().toISOString();
    if (isMock()) {
      const job: ResearchJob = { raceId, status: "running", interactionId: `mock-${Date.now()}`, startedAt, progress: [], cached: false };
      await cacheSet("research", raceId, job);
      return job;
    }

    await reserveDeepResearch(`research ${raceId}`); // throws BudgetError -> HTTP 402
    // Reserve the slot on disk before the network call so a crash/refresh cannot double-start.
    const queued: ResearchJob = { raceId, status: "queued", startedAt, progress: [], estimatedCostUsd: DEEP_RESEARCH_ESTIMATE, cached: false };
    await cacheSet("research", raceId, queued);
    try {
      const it = await api("POST", BASE, {
        agent: deepResearchAgent(),
        input: researchPrompt(ctx.race, { state: ctx.location?.state, county: ctx.location?.county }),
        background: true,
        agent_config: { type: "deep-research", thinking_summaries: "auto", collaborative_planning: false },
        tools: [{ type: "google_search" }, { type: "url_context" }],
      });
      const job: ResearchJob = { ...queued, status: it.status === "completed" ? "completed" : "running", interactionId: it.id };
      await cacheSet("research", raceId, job);
      return job;
    } catch (e) {
      // No automatic retry (paid). Mark failed; refund only for definite pre-run rejections (4xx).
      const msg = String((e as Error).message);
      if (/Interactions API 4\d\d/.test(msg)) await refundDeepResearch(`create rejected for ${raceId}`);
      const failed: ResearchJob = { ...queued, status: "failed", error: msg.slice(0, 500) };
      await cacheSet("research", raceId, failed);
      return failed;
    }
  });
}
