import type { AskResponse, CandidateProfile, Race, ResearchJob, VoterLocation } from "../types";

const src = (t: string, u: string) => ({ title: t, url: u });

export function mockRaces(l: VoterLocation): { races: Race[]; verifyUrl: string } {
  const st = l.state.toLowerCase();
  const mk = (slugId: string, title: string, level: Race["level"], names: [string, string, boolean?][]): Race => ({
    id: slugId,
    title,
    level,
    kind: "candidate",
    seats: 1,
    description: `Mock description for ${title}.`,
    candidates: names.map(([name, party, inc]) => ({
      id: `${slugId}-${name.toLowerCase().replace(/[^a-z]+/g, "-")}`,
      name,
      party,
      incumbent: !!inc,
      source: src("Mock candidate list (not real data)", "https://example.com/mock-candidate-list"),
    })),
  });
  return {
    verifyUrl: "https://example.com/mock-sample-ballot",
    races: [
      mk(`${st}-us-house-${l.congressionalDistrict ?? "x"}`, `U.S. Representative, District ${l.congressionalDistrict ?? "X"}`, "federal", [["Alex Sample", "DEM", true], ["Jordan Example", "REP"]]),
      mk(`${st}-state-senate-${l.stateSenateDistrict ?? "x"}`, `State Senator, District ${l.stateSenateDistrict ?? "X"}`, "state", [["Casey Mockman", "REP"], ["Riley Placeholder", "DEM"], ["Sam Filler", "NPA"]]),
      mk(`${st}-school-board-2`, "School Board Member, District 2", "school", [["Taylor Demo", "Nonpartisan"], ["Morgan Test", "Nonpartisan"]]),
    ],
  };
}

export function mockCandidate(raceId: string, candidateId: string, name: string): CandidateProfile {
  return {
    candidateId,
    raceId,
    name,
    summary: `MOCK DATA. ${name} is a candidate in this race. According to the mock source, they have listed experience in local public service. No verified information found on other topics.`,
    background: [
      { label: "Occupation", text: "According to the campaign website (mock), works in local business.", sourceIndexes: [0] },
      { label: "Education", text: "No verified information found.", sourceIndexes: [] },
    ],
    positions: [
      { label: "Housing", text: "The campaign website (mock) states support for a study of housing costs.", sourceIndexes: [0] },
      { label: "Education", text: "No verified information found.", sourceIndexes: [] },
    ],
    funding: [{ label: "Reported contributions", text: "According to mock filings, $12,345 raised.", sourceIndexes: [1] }],
    endorsements: [{ label: "Endorsements", text: "No verified information found.", sourceIndexes: [] }],
    website: "https://example.com/mock-candidate",
    sources: [src("Mock campaign website", "https://example.com/mock-candidate"), src("Mock finance filing", "https://example.com/mock-filing")],
    model: "mock",
    generatedAt: new Date().toISOString(),
    cached: false,
  };
}

export function mockAsk(question: string): AskResponse {
  return {
    answer: `MOCK ANSWER. You asked: "${question.slice(0, 120)}". According to mock sources, no verified information is available. BallotScout does not recommend candidates.`,
    sources: [src("Mock source", "https://example.com/mock-source")],
    model: "mock",
  };
}

const STEPS = [
  "Planning research: identifying candidates and primary sources",
  "Searching official election-office and candidate sites",
  "Reading campaign finance filings",
  "Cross-checking stated positions across sources",
  "Drafting side-by-side comparison",
];

/** Mock job advances with wall-clock time: ~5s per step, completes after STEPS.length*5s. */
export function mockJobAt(job: ResearchJob, race: Race | null): ResearchJob {
  const elapsed = (Date.now() - new Date(job.startedAt ?? Date.now()).getTime()) / 1000;
  const n = Math.min(STEPS.length, Math.floor(elapsed / 5) + 1);
  const progress = STEPS.slice(0, n);
  if (elapsed < STEPS.length * 5) return { ...job, status: "running", progress };
  const title = race?.title ?? job.raceId;
  const rows = (race?.candidates ?? []).map((c) => `### ${c.name}${c.party ? ` (${c.party})` : ""}\n- **Background:** No verified information found. [1]\n- **Positions:** According to mock sources, none stated. [1]\n- **Funding:** No verified information found.\n- **Endorsements:** No verified information found.\n`).join("\n");
  return {
    ...job,
    status: "completed",
    completedAt: new Date().toISOString(),
    progress: [...progress, "Report complete"],
    reportMarkdown: `# ${title}: candidate comparison (MOCK)\n\nThis is a canned report for UI development.\n\n${rows}\n## What we couldn't verify\n- Everything; this is mock data. [1]\n`,
    sources: [src("Mock source", "https://example.com/mock-source")],
    estimatedCostUsd: 0,
  };
}
