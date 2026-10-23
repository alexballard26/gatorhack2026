import type { BallotResponse, Race, RaceLevel, SeedRace, VoterLocation } from "../types";
import { cacheGet, cacheSet, once, slug } from "./cache";
import { AiError, ELECTION_DATE, ELECTION_NAME, isMock } from "./config";
import { flashJson } from "./gemini";
import { mockRaces } from "./mock";
import { ballotPrompt } from "./prompts";
import { indexRaces, readSeed } from "./store";

const norm = (s?: string) => (s ?? "").trim().toLowerCase().replace(/^0+(?=\d)/, "");

function appliesToVoter(r: SeedRace, l: VoterLocation) {
  const a = r.appliesTo;
  if (!a) return true;
  return (
    (!a.congressionalDistrict || norm(a.congressionalDistrict) === norm(l.congressionalDistrict)) &&
    (!a.stateSenateDistrict || norm(a.stateSenateDistrict) === norm(l.stateSenateDistrict)) &&
    (!a.stateHouseDistrict || norm(a.stateHouseDistrict) === norm(l.stateHouseDistrict)) &&
    (!a.place || norm(a.place) === norm(l.place))
  );
}

export function districtKey(l: VoterLocation) {
  return [l.state, l.county, `cd${l.congressionalDistrict ?? ""}`, `sd${l.stateSenateDistrict ?? ""}`, `hd${l.stateHouseDistrict ?? ""}`, l.place ?? ""].map((x) => slug(x ?? "")).join("_");
}

const LEVELS: RaceLevel[] = ["federal", "state", "county", "municipal", "judicial", "school", "special-district"];
const isUrl = (u: unknown): u is string => typeof u === "string" && /^https?:\/\/[^\s]+\.[^\s]+/i.test(u);

/** Validate model output into Race[], dropping any candidate without a source URL. */
export function validateRaces(raw: unknown, l: VoterLocation): { races: Race[]; verifyUrl?: string } {
  const obj = raw as { races?: unknown; verifyUrl?: unknown };
  const arr = Array.isArray(raw) ? raw : obj?.races;
  if (!Array.isArray(arr)) throw new Error("no races array");
  const seen = new Set<string>();
  const races: Race[] = [];
  for (const r of arr as Record<string, unknown>[]) {
    if (!r || typeof r.title !== "string") continue;
    let id = slug(typeof r.id === "string" && r.id ? r.id : `${l.state}-${r.title}`);
    while (seen.has(id)) id += "-2";
    seen.add(id);
    const kind = r.kind === "measure" || r.kind === "retention" ? r.kind : "candidate";
    const cs = Array.isArray(r.candidates) ? (r.candidates as Record<string, unknown>[]) : [];
    const cseen = new Set<string>();
    const candidates = cs.flatMap((c) => {
      const s = c?.source as { url?: unknown; title?: unknown } | undefined;
      if (!c || typeof c.name !== "string" || !c.name.trim() || !s || !isUrl(s.url)) return []; // no source URL -> dropped
      let cid = slug(`${id}-${c.name}`);
      while (cseen.has(cid)) cid += "-2";
      cseen.add(cid);
      return [
        {
          id: cid,
          name: c.name.trim(),
          ...(typeof c.party === "string" && c.party ? { party: c.party } : {}),
          ...(typeof c.incumbent === "boolean" ? { incumbent: c.incumbent } : {}),
          source: { title: typeof s.title === "string" && s.title ? s.title : "Source", url: s.url },
        },
      ];
    });
    if (kind === "candidate" && candidates.length === 0) continue;
    races.push({
      id,
      title: r.title,
      level: LEVELS.includes(r.level as RaceLevel) ? (r.level as RaceLevel) : "state",
      ...(typeof r.description === "string" && r.description ? { description: r.description } : {}),
      seats: typeof r.seats === "number" && r.seats > 0 ? r.seats : 1,
      kind,
      ...(typeof r.measureSummary === "string" && r.measureSummary ? { measureSummary: r.measureSummary } : {}),
      candidates: kind === "candidate" ? candidates : [],
    });
  }
  if (!races.length) throw new Error("no valid races after filtering");
  return { races, verifyUrl: isUrl(obj?.verifyUrl) ? (obj.verifyUrl as string) : undefined };
}

export async function getBallot(l: VoterLocation): Promise<BallotResponse> {
  // a. verified seed
  if (l.county) {
    const seed = await readSeed(l.state, l.county);
    if (seed) {
      const races: Race[] = seed.races.filter((r) => appliesToVoter(r, l)).map(({ appliesTo: _a, ...r }) => r);
      await indexRaces(races, l);
      return {
        electionName: seed.electionName,
        electionDate: seed.electionDate,
        location: l,
        races,
        provenance: "official-seed",
        verifyUrl: seed.verifyUrl,
        ...(seed.notes ? { notes: seed.notes } : {}),
        generatedAt: seed.compiledAt,
      };
    }
  }
  if (isMock()) {
    const m = mockRaces(l);
    await indexRaces(m.races, l);
    return { electionName: ELECTION_NAME, electionDate: ELECTION_DATE, location: l, races: m.races, provenance: "ai-live", verifyUrl: m.verifyUrl, generatedAt: new Date().toISOString() };
  }
  // b. cached AI ballot
  const key = districtKey(l);
  const cached = await cacheGet<BallotResponse>("ballot", key);
  if (cached) {
    await indexRaces(cached.races, l);
    return { ...cached, provenance: "ai-cached" };
  }
  // c. live generation (deduped across concurrent requests)
  return once(`ballot:${key}`, async () => {
    const { value, model } = await flashJson(ballotPrompt(l), { grounded: true, note: `ballot ${key}` }, (raw) => validateRaces(raw, l));
    const ballot: BallotResponse = {
      electionName: ELECTION_NAME,
      electionDate: ELECTION_DATE,
      location: l,
      races: value.races,
      provenance: "ai-live",
      verifyUrl: value.verifyUrl,
      generatedAt: new Date().toISOString(),
    };
    void model;
    await cacheSet("ballot", key, ballot);
    await indexRaces(ballot.races, l);
    return ballot;
  });
}

export { AiError };
