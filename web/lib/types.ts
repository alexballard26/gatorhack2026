// Shared contracts between geo, AI backend, and UI. Owned by the orchestrator:
// workers may add optional fields, but must not rename or remove existing ones.

/** A source citation shown next to any AI-produced or data-derived claim. */
export interface Source {
  title: string;
  url: string;
}

/** Districts and jurisdictions that determine which races a voter sees. */
export interface VoterLocation {
  /** Normalized address, if the user entered one. */
  address?: string;
  lat?: number;
  lng?: number;
  /** Two-letter postal code, e.g. "FL". */
  state: string;
  /** County name without the word "County", e.g. "Alachua". */
  county?: string;
  /** Congressional district number as a string, e.g. "3". "AL" for at-large. */
  congressionalDistrict?: string;
  /** State senate district number, e.g. "9". */
  stateSenateDistrict?: string;
  /** State house / assembly district number, e.g. "21". */
  stateHouseDistrict?: string;
  /** Incorporated place, e.g. "Gainesville", if inside one. */
  place?: string;
  /** Congressional district for the same point under the previous (119th Congress) map. */
  previousCongressionalDistrict?: string;
  /** How this location was determined. */
  method: "address" | "map-click" | "manual";
}

/** GeoJSON boundaries for the map, keyed by layer. */
export interface DistrictBoundaries {
  congressional?: GeoJSON.Feature;
  stateSenate?: GeoJSON.Feature;
  stateHouse?: GeoJSON.Feature;
  county?: GeoJSON.Feature;
  /** Previous (119th Congress) congressional district containing the same point. */
  previousCongressional?: GeoJSON.Feature;
}

/** GET /api/districts?address=... or ?lat=..&lng=.. */
export interface DistrictsResponse {
  location: VoterLocation;
  boundaries: DistrictBoundaries;
  /** Which boundary vintage was drawn, e.g. "120th Congressional Districts". */
  boundaryVintage?: string;
}

export type RaceLevel = "federal" | "state" | "county" | "municipal" | "judicial" | "school" | "special-district";

export interface Candidate {
  /** Stable slug, e.g. "fl-cd3-jane-doe". */
  id: string;
  name: string;
  /** Party as listed on the ballot, e.g. "REP", "DEM", "NPA", "Nonpartisan". */
  party?: string;
  incumbent?: boolean;
  /** Where we confirmed this person is on the ballot. Required: no source, no candidate. */
  source: Source;
}

export interface Race {
  /** Stable slug, e.g. "fl-us-house-3", "alachua-school-board-2". */
  id: string;
  /** Display title as on the ballot, e.g. "U.S. Representative, District 3". */
  title: string;
  level: RaceLevel;
  /** Short neutral description of the office. */
  description?: string;
  /** Number of seats to fill (default 1). */
  seats?: number;
  candidates: Candidate[];
  /** Ballot measures / retention questions use this instead of candidates. */
  kind: "candidate" | "measure" | "retention";
  /** For measures: the ballot summary text and Yes/No meaning. */
  measureSummary?: string;
}

/** Where a ballot came from — shown to the user as a trust badge. */
export type BallotProvenance = "official-seed" | "ai-cached" | "ai-live";

/** GET /api/ballot?state=..&county=..&cd=..&sd=..&hd=..&place=.. */
export interface BallotResponse {
  electionName: string; // e.g. "2026 General Election"
  electionDate: string; // ISO date, "2026-11-03"
  location: VoterLocation;
  races: Race[];
  provenance: BallotProvenance;
  /** Official sample-ballot or elections-office link the voter should verify against. */
  verifyUrl?: string;
  /** Coverage caveats to show the voter (from SeedBallot.notes). */
  notes?: string;
  generatedAt: string; // ISO timestamp
}

/** Quick, neutral candidate card. GET /api/candidate?raceId=..&candidateId=.. */
export interface CandidateProfile {
  candidateId: string;
  raceId: string;
  name: string;
  summary: string; // 2–3 neutral sentences
  background: ProfileItem[]; // career, education, prior offices
  positions: ProfileItem[]; // stated positions, by issue
  funding?: ProfileItem[];
  endorsements?: ProfileItem[];
  website?: string;
  sources: Source[];
  model: string;
  generatedAt: string;
  cached: boolean;
}

/** One cited claim. sourceIndexes point into the parent's sources array. */
export interface ProfileItem {
  label: string; // e.g. "Housing", "Education", "Occupation"
  text: string;
  sourceIndexes: number[];
}

/** Deep Research job for a whole race. POST /api/research {raceId} starts; GET /api/research?raceId= polls. */
export type ResearchStatus = "not-started" | "queued" | "running" | "completed" | "failed" | "budget-blocked";

export interface ResearchJob {
  raceId: string;
  status: ResearchStatus;
  /** Gemini interaction id, used for polling. */
  interactionId?: string;
  startedAt?: string;
  completedAt?: string;
  /** Markdown report with inline citation markers. */
  reportMarkdown?: string;
  sources?: Source[];
  /** Charts the agent generated, as data: URLs (e.g. data:image/png;base64,...). */
  images?: string[];
  /** Progress notes / thought summaries streamed from the agent, newest last. */
  progress?: string[];
  error?: string;
  estimatedCostUsd?: number;
  cached: boolean;
}

/** POST /api/ask {raceId, candidateId?, question} */
export interface AskResponse {
  answer: string;
  sources: Source[];
  model: string;
}

/**
 * Verified seed ballot built from official sources, at data/ballots/<state>-<county>-2026.json
 * (e.g. data/ballots/fl-alachua-2026.json). A race with no `appliesTo` is on every ballot in the county.
 */
export interface SeedBallot {
  electionName: string;
  electionDate: string;
  state: string;
  county: string;
  verifyUrl: string;
  /** Official pages used to build this file. */
  sources: Source[];
  compiledAt: string;
  /** Coverage caveats shown to the voter, e.g. "county contests not yet included". */
  notes?: string;
  races: SeedRace[];
}

export interface SeedRace extends Race {
  /** Only voters matching ALL listed fields see this race. */
  appliesTo?: {
    congressionalDistrict?: string;
    stateSenateDistrict?: string;
    stateHouseDistrict?: string;
    place?: string;
  };
}

/** Shape of the spend ledger at data/spend.json. */
export interface SpendLedger {
  budgetUsd: number;
  spentUsd: number;
  entries: { at: string; kind: "flash" | "grounding" | "deep-research"; usd: number; note: string }[];
}
