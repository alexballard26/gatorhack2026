import type { CandidateProfile, ProfileItem, Source } from "../types";
import { cacheGet, cacheSet, once } from "./cache";
import { AiError, isMock } from "./config";
import { flashJson } from "./gemini";
import { mockCandidate } from "./mock";
import { candidatePrompt } from "./prompts";
import { findRace } from "./store";

const isUrl = (u: unknown): u is string => typeof u === "string" && /^https?:\/\//i.test(u);

function items(raw: unknown, nSources: number): ProfileItem[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((x: Record<string, unknown>) => {
    if (!x || typeof x.text !== "string" || !x.text.trim()) return [];
    const idx = (Array.isArray(x.sourceIndexes) ? x.sourceIndexes : []).filter((i): i is number => Number.isInteger(i) && i >= 0 && i < nSources);
    return [{ label: typeof x.label === "string" && x.label ? x.label : "Item", text: x.text.trim(), sourceIndexes: idx }];
  });
}

export interface CandidateQuery {
  raceId: string;
  candidateId: string;
  name?: string;
  party?: string;
  raceTitle?: string;
}

export async function getCandidate(q: CandidateQuery): Promise<CandidateProfile> {
  const ctx = await findRace(q.raceId);
  const found = ctx?.race.candidates.find((c) => c.id === q.candidateId);
  const name = found?.name ?? q.name;
  if (!name) throw new AiError("Unknown race/candidate; pass name (and optionally party, raceTitle) as a fallback.", 404);
  const party = found?.party ?? q.party;

  if (isMock()) return mockCandidate(q.raceId, q.candidateId, name);

  const key = `${q.raceId}__${q.candidateId}`;
  const hit = await cacheGet<CandidateProfile>("candidate", key);
  if (hit) return { ...hit, cached: true };

  return once(`candidate:${key}`, async () => {
    const race = ctx?.race ?? { title: q.raceTitle ?? q.raceId, candidates: [{ name, party }] };
    const { value, sources: grounding, model } = await flashJson(candidatePrompt(race, { name, party }), { grounded: true, note: `candidate ${key}` }, (raw) => {
      if (!raw || typeof raw !== "object" || typeof (raw as { summary?: unknown }).summary !== "string") throw new Error("missing summary");
      return raw as Record<string, unknown>;
    });
    // Sources: model-declared sources (real URLs it cited) first so sourceIndexes line up; then grounding sources appended.
    const declared: Source[] = (Array.isArray(value.sources) ? (value.sources as Record<string, unknown>[]) : [])
      .filter((s) => s && isUrl(s.url))
      .map((s) => ({ title: typeof s.title === "string" && s.title ? s.title : String(s.url), url: String(s.url) }));
    const sources = [...declared];
    for (const g of grounding) if (!sources.some((s) => s.url === g.url)) sources.push(g);
    const n = sources.length;
    const profile: CandidateProfile = {
      candidateId: q.candidateId,
      raceId: q.raceId,
      name,
      summary: String(value.summary).trim(),
      background: items(value.background, declared.length),
      positions: items(value.positions, declared.length),
      funding: items(value.funding, declared.length),
      endorsements: items(value.endorsements, declared.length),
      website: isUrl(value.website) ? value.website : undefined,
      sources,
      model,
      generatedAt: new Date().toISOString(),
      cached: false,
    };
    void n;
    await cacheSet("candidate", key, profile);
    return profile;
  });
}
