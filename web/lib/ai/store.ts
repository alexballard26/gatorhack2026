import fs from "fs/promises";
import path from "path";
import type { Race, SeedBallot, SeedRace, VoterLocation } from "../types";
import { cacheGet, cacheSet } from "./cache";
import { DATA_DIR } from "./config";

export interface RaceContext {
  race: Race;
  location?: Partial<VoterLocation>;
}

/** Remember every race we have shown, so candidate/research/ask can look them up by id. */
export async function indexRaces(races: Race[], location: VoterLocation) {
  await Promise.all(races.map((r) => cacheSet<RaceContext>("race-index", r.id, { race: r, location })));
}

export async function readSeed(state: string, county: string): Promise<SeedBallot | null> {
  const f = path.join(DATA_DIR, "ballots", `${state.toLowerCase()}-${county.toLowerCase().replace(/\s+/g, "-")}-2026.json`);
  try {
    return JSON.parse(await fs.readFile(f, "utf8")) as SeedBallot;
  } catch {
    return null;
  }
}

export async function findRace(raceId: string): Promise<RaceContext | null> {
  const idx = await cacheGet<RaceContext>("race-index", raceId);
  if (idx) return idx;
  // Fall back to scanning seed files (they may be added after the index was built).
  try {
    const dir = path.join(DATA_DIR, "ballots");
    for (const f of await fs.readdir(dir)) {
      if (!f.endsWith(".json")) continue;
      try {
        const seed = JSON.parse(await fs.readFile(path.join(dir, f), "utf8")) as SeedBallot;
        const r = seed.races?.find((x: SeedRace) => x.id === raceId);
        if (r) return { race: r, location: { state: seed.state, county: seed.county } };
      } catch {}
    }
  } catch {}
  return null;
}
