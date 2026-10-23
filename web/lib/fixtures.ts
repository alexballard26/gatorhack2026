// Clearly fake demo data for developing the UI offline (NEXT_PUBLIC_USE_FIXTURES=1).
// All people, organizations and URLs below are fictional.
import type {
  AskResponse,
  BallotResponse,
  Candidate,
  CandidateProfile,
  DistrictsResponse,
  Race,
  ResearchJob,
  VoterLocation,
} from "./types";
import type { LocationQuery } from "./api";

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

function rect(w: number, s: number, e: number, n: number, props: Record<string, string>): GeoJSON.Feature {
  return {
    type: "Feature",
    properties: props,
    geometry: {
      type: "Polygon",
      coordinates: [
        [
          [w, s],
          [e, s],
          [e, n],
          [w, n],
          [w, s],
        ],
      ],
    },
  };
}

export async function districts(q: LocationQuery): Promise<DistrictsResponse> {
  await wait(700);
  const lat = q.lat ? Number(q.lat) : 29.6516;
  const lng = q.lng ? Number(q.lng) : -82.3248;
  const manual = !q.address && !(q.lat && q.lng);
  return {
    location: {
      address: q.address ? `${q.address} (fixture)` : undefined,
      lat,
      lng,
      state: (q.state || "FL").toUpperCase(),
      county: q.county || "Alachua",
      congressionalDistrict: q.cd || "3",
      stateSenateDistrict: q.sd || "9",
      stateHouseDistrict: q.hd || "21",
      place: "Gainesville",
      method: q.address ? "address" : manual ? "manual" : "map-click",
    },
    boundaries: {
      county: rect(-82.66, 29.4, -82.05, 29.95, { name: "Alachua County" }),
      congressional: rect(-82.9, 29.15, -81.85, 30.2, { name: "Congressional District 3" }),
      stateSenate: rect(-82.55, 29.5, -82.1, 29.85, { name: "State Senate District 9" }),
      stateHouse: rect(-82.43, 29.58, -82.2, 29.72, { name: "State House District 21" }),
    },
  };
}

const src = (title: string, slug: string) => ({ title, url: `https://example.org/demo/${slug}` });

function cand(raceId: string, name: string, party: string, incumbent = false): Candidate {
  const slug = name.toLowerCase().replace(/[^a-z]+/g, "-");
  return { id: `${raceId}-${slug}`, name, party, incumbent, source: src("Demo qualifying list (fake)", "qualifying") };
}

function races(): Race[] {
  const mk = (id: string, title: string, level: Race["level"], description: string, cs: [string, string, boolean?][]): Race => ({
    id,
    title,
    level,
    description,
    kind: "candidate",
    seats: 1,
    candidates: cs.map(([n, p, i]) => cand(id, n, p, i)),
  });
  return [
    mk("fl-us-house-3", "U.S. Representative, District 3", "federal", "Represents the district in the U.S. House for a two-year term.", [
      ["Dana Whitfield", "REP", true],
      ["Marcus Ogunleye", "DEM"],
      ["Priya Raman", "NPA"],
    ]),
    mk("fl-governor", "Governor", "state", "Chief executive of the state for a four-year term.", [
      ["Elena Castellano", "REP"],
      ["Thomas Birkeland", "DEM"],
      ["Jordan Lacey", "LPF"],
    ]),
    mk("fl-senate-9", "State Senator, District 9", "state", "Votes on state laws and the state budget.", [
      ["Harold Nguyen", "DEM", true],
      ["Cassidy Frame", "REP"],
    ]),
    mk("fl-house-21", "State Representative, District 21", "state", "Votes on state laws in the state House.", [
      ["Imani Brooks", "DEM"],
      ["Walter Pruitt", "REP", true],
    ]),
    mk("alachua-commission-2", "County Commission, District 2", "county", "Sets the county budget and land-use policy.", [
      ["Rosa Delgado", "Nonpartisan", true],
      ["Ben Achterberg", "Nonpartisan"],
      ["Kimberly Osei", "Nonpartisan"],
    ]),
    mk("alachua-school-board-2", "School Board, District 2", "school", "Oversees the public school district.", [
      ["Nadia Farrow", "Nonpartisan"],
      ["Gregory Tanaka", "Nonpartisan", true],
    ]),
    {
      id: "fl-judicial-retention-1",
      title: "Retention of Justice Avery Lindqvist",
      level: "judicial",
      kind: "retention",
      description: "Shall Justice Avery Lindqvist be retained in office?",
      measureSummary: "A YES vote keeps the justice in office for another term. A NO vote removes the justice from office.",
      candidates: [],
    },
    {
      id: "fl-amendment-1",
      title: "Amendment 1: Local Park Funding (demo)",
      level: "state",
      kind: "measure",
      description: "Proposed change to the state constitution.",
      measureSummary:
        "Would allow counties to dedicate a portion of existing property tax revenue to public parks and trails. A YES vote approves the change; a NO vote keeps current law.",
      candidates: [],
    },
  ];
}

export async function ballot(loc: VoterLocation): Promise<BallotResponse> {
  await wait(900);
  return {
    electionName: "2026 General Election",
    electionDate: "2026-11-03",
    location: loc,
    races: races(),
    provenance: "ai-cached",
    verifyUrl: "https://example.org/demo/sample-ballot",
    generatedAt: new Date().toISOString(),
  };
}

export async function candidate(raceId: string, candidateId: string): Promise<CandidateProfile> {
  await wait(1800);
  const c = races()
    .find((r) => r.id === raceId)
    ?.candidates.find((x) => x.id === candidateId);
  const name = c?.name ?? "Candidate";
  return {
    candidateId,
    raceId,
    name,
    summary: `${name} is running for this office in the November 3, 2026 general election. This is demo text generated for interface development and does not describe a real person.`,
    background: [
      { label: "Occupation", text: "Small-business owner and former civic volunteer (demo).", sourceIndexes: [0] },
      { label: "Education", text: "Bachelor's degree in public administration (demo).", sourceIndexes: [0, 1] },
      { label: "Prior offices", text: "Served on a neighborhood advisory board from 2018 to 2022 (demo).", sourceIndexes: [1] },
    ],
    positions: [
      { label: "Housing", text: "Supports expanding the supply of homes near job centers and streamlining permitting (demo).", sourceIndexes: [2] },
      { label: "Education", text: "Favors increased funding for early-childhood programs and teacher retention (demo).", sourceIndexes: [2, 3] },
      { label: "Environment", text: "Prioritizes protecting springs and aquifer recharge areas (demo).", sourceIndexes: [3] },
    ],
    funding: [{ label: "Reported contributions", text: "Reported $48,200 raised, mostly from individual donors giving under $200 (demo figures).", sourceIndexes: [4] }],
    endorsements: [{ label: "Endorsed by", text: "Alachua Neighbors Association; Local Teachers Forum (fictional organizations).", sourceIndexes: [5] }],
    website: "https://example.org/demo/campaign",
    sources: [
      src("Campaign biography (demo)", "bio"),
      src("Local newspaper profile (demo)", "profile"),
      src("Candidate questionnaire (demo)", "questionnaire"),
      src("Forum transcript (demo)", "forum"),
      src("Campaign finance report (demo)", "finance"),
      src("Endorsement list (demo)", "endorsements"),
    ],
    model: "fixture",
    generatedAt: new Date().toISOString(),
    cached: false,
  };
}

// ---- Deep Research simulation: advances by wall-clock time since start ----
const started = new Map<string, number>();
const STEPS = [
  "Planning research: identifying all candidates, official filings and the office's responsibilities",
  "Searching candidate websites, campaign finance reports and local news coverage",
  "Cross-checking claims against 14 sources and discarding unverified material",
  "Comparing stated positions side by side on housing, education and the environment",
  "Drafting a neutral, cited comparison report",
];
const REPORT = `# Race overview

This neutral comparison covers the candidates listed on the official qualifying list. Positions are drawn from candidate-published material and independent reporting [1][2].

## Where candidates stand

**Housing.** One candidate emphasizes permitting reform and new construction near job centers [3]. Another prioritizes tenant protections and rent assistance programs [4]. A third has not published a detailed housing plan.

**Education.** Candidates differ on how to balance early-childhood funding against teacher pay [3, 5].

## Funding

Reported contributions range from $12,000 to $48,200 across the field, with most money coming from individual donors [6].

## What we could not verify

We found no public statement from one candidate on the environment; this is noted rather than inferred.

*Demo report with fictional content for interface development.*`;

export async function startResearch(raceId: string): Promise<ResearchJob> {
  await wait(500);
  started.set(raceId, Date.now());
  return { raceId, status: "queued", startedAt: new Date().toISOString(), progress: [], cached: false };
}

export async function pollResearch(raceId: string): Promise<ResearchJob> {
  await wait(300);
  const t0 = started.get(raceId);
  if (!t0) return { raceId, status: "not-started", cached: false };
  const secs = (Date.now() - t0) / 1000;
  const n = Math.min(STEPS.length, Math.floor(secs / 4));
  const startedAt = new Date(t0).toISOString();
  if (secs >= STEPS.length * 4 + 2) {
    return {
      raceId,
      status: "completed",
      startedAt,
      completedAt: new Date().toISOString(),
      progress: STEPS,
      reportMarkdown: REPORT,
      sources: [
        src("Official qualifying list (demo)", "qualifying"),
        src("County elections office (demo)", "elections"),
        src("Candidate website A (demo)", "site-a"),
        src("Local housing report (demo)", "housing"),
        src("School district budget (demo)", "schools"),
        src("Campaign finance database (demo)", "finance"),
      ],
      estimatedCostUsd: 1.4,
      cached: false,
    };
  }
  return { raceId, status: secs < 2 ? "queued" : "running", startedAt, progress: STEPS.slice(0, n), cached: false };
}

export async function ask(input: { raceId: string; candidateId?: string; question: string }): Promise<AskResponse> {
  await wait(1400);
  return {
    answer: `Here is a neutral summary in response to "${input.question}". Candidates in this demo race differ mainly in emphasis: one focuses on increasing the supply of homes [1], another on renter protections [2]. Details are fictional fixture data.`,
    sources: [src("Candidate questionnaire (demo)", "questionnaire"), src("Local housing report (demo)", "housing")],
    model: "fixture",
  };
}
