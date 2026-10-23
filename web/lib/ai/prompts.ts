import type { Candidate, Race, VoterLocation } from "../types";

export const NEUTRALITY = `NEUTRALITY RULES (mandatory):
- Strictly nonpartisan. Use the same structure and level of detail for every candidate.
- No adjectives that praise or criticize. Use plain factual language.
- Attribute every claim ("X says", "according to Y", "X's campaign website states").
- Never recommend, rank, or hint at which candidate to vote for.
- Use only information found in sources; if information is not available, write "No verified information found" rather than guessing.
- Do not state anything about a candidate's character; report records, statements, and documented facts only.`;

export function locDescription(l: VoterLocation) {
  return [
    `State: ${l.state}`,
    l.county && `County: ${l.county} County`,
    l.congressionalDistrict && `U.S. Congressional District: ${l.congressionalDistrict}`,
    l.stateSenateDistrict && `State Senate District: ${l.stateSenateDistrict}`,
    l.stateHouseDistrict && `State House District: ${l.stateHouseDistrict}`,
    l.place && `City/place: ${l.place}`,
  ]
    .filter(Boolean)
    .join("\n");
}

export function ballotPrompt(l: VoterLocation) {
  return `You are compiling the official list of contests on the November 3, 2026 general election ballot for a voter located in:
${locDescription(l)}

Use Google Search. PREFER OFFICIAL SOURCES: the state Division of Elections candidate/qualifying list, and the county Supervisor of Elections (or county elections office) sample ballot. Use news or Ballotpedia only to fill gaps.
Include: U.S. Senate (if on the ballot in this state in 2026), U.S. House, Governor and statewide offices, state legislature seats for this voter's districts, county offices, school board, municipal and judicial contests, judicial retention questions, and ballot measures that apply to this voter.
Only include candidates who have qualified / are certified for the November general election ballot. Do not include candidates eliminated in primaries.

Return STRICT JSON only (no prose, no code fences): an object
{"verifyUrl": string|null, "races": Race[]}
where verifyUrl is the official county sample-ballot or elections-office page if you found one, and each Race is:
{"id": string (lowercase slug like "fl-us-house-3"), "title": string (as printed on the ballot), "level": "federal"|"state"|"county"|"municipal"|"judicial"|"school"|"special-district", "description": string (one neutral sentence on what the office does), "seats": number, "kind": "candidate"|"measure"|"retention", "measureSummary": string (measures/retention only), "candidates": [{"id": string slug, "name": string, "party": string (as on ballot, e.g. "REP","DEM","NPA","Nonpartisan"), "incumbent": boolean, "source": {"title": string, "url": string}}]}
EVERY candidate MUST have a source.url (a real page where you confirmed they are on the ballot). Candidates without a source URL will be discarded. Never invent candidates or URLs. For ballot measures and retention questions use an empty candidates array.
${NEUTRALITY}`;
}

export function candidateContext(race: { title: string; description?: string; candidates: Pick<Candidate, "name" | "party">[] }) {
  return `Race: ${race.title}${race.description ? ` (${race.description})` : ""}
Candidates in this race: ${race.candidates.map((c) => `${c.name}${c.party ? ` (${c.party})` : ""}`).join("; ")}`;
}

export function candidatePrompt(race: Parameters<typeof candidateContext>[0], c: { name: string; party?: string }) {
  return `Research the candidate ${c.name}${c.party ? ` (${c.party})` : ""} for the November 3, 2026 election.
${candidateContext(race)}

Use Google Search. Prefer the candidate's official campaign website, government/election-office pages, court and campaign-finance filings (e.g. FEC or state filings), and reputable news.
Return STRICT JSON only (no prose, no code fences):
{"summary": string (2-3 neutral sentences), "background": [{"label": string, "text": string}], "positions": [{"label": string (issue), "text": string}], "funding": [{"label": string, "text": string}], "endorsements": [{"label": string, "text": string}], "website": string|null, "sources": [{"title": string, "url": string}]}
Every item's text must be attributed (e.g. "According to ...", "Campaign website states ..."). Add "sourceIndexes": number[] to every item: indexes into your "sources" array that support that item (a claim with no source must be omitted, or text exactly "No verified information found" with sourceIndexes []).
Use identical categories for every candidate: background = occupation, education, prior public offices; positions = stated positions on the main issues of this office; funding = reported campaign finance totals; endorsements = publicly announced endorsements.
${NEUTRALITY}`;
}

export function askPrompt(
  race: { title: string; description?: string; candidates: Pick<Candidate, "name" | "party">[] } | null,
  candidateName: string | undefined,
  question: string,
) {
  return `You answer voter questions for a nonpartisan voter-education site about the November 3, 2026 election.
${race ? candidateContext(race) : "Race context unavailable."}
${candidateName ? `The question is about candidate: ${candidateName}.` : ""}

Use Google Search and answer ONLY from sources you find; cite the source in prose (e.g. "according to the candidate's website"). If you cannot verify the answer, say "No verified information found".
If asked who to vote for, who is better, or for any recommendation or prediction, politely decline in one sentence and instead offer neutral, sourced facts that could help the voter decide.
Keep the answer under 180 words. Plain text, no markdown headers.
${NEUTRALITY}

Voter question: """${question.slice(0, 600)}"""`;
}

export function researchPrompt(race: Race, ctx: { state?: string; county?: string }) {
  const cands = race.candidates.map((c) => `- ${c.name}${c.party ? ` (${c.party})` : ""}${c.incumbent ? ", incumbent" : ""} [ballot source: ${c.source.url}]`).join("\n");
  return `Produce a neutral, thoroughly cited side-by-side voter guide report for this contest on the November 3, 2026 general election ballot${ctx.county ? ` (${ctx.county} County, ${ctx.state ?? ""})` : ""}:

Contest: ${race.title}${race.description ? ` - ${race.description}` : ""}
Candidates:
${cands}

For EACH candidate, using the same headings and the same level of detail, cover:
1. Background (occupation, education, prior public service)
2. Stated positions on the major issues relevant to this office (attribute each to the candidate's own statements, website, debates, or questionnaires)
3. Public record (votes, decisions, or documented professional record, if any)
4. Campaign funding (totals and top donor categories from official filings such as FEC / state filings)
5. Publicly announced endorsements
Then include a side-by-side comparison table of stated positions, and a final section titled "What we couldn't verify" listing any information that could not be confirmed from sources.

Prefer primary sources: official campaign sites, government and election-office pages, campaign-finance databases, court records, and reputable news. Cite every factual claim.
${NEUTRALITY}
Output Markdown.`;
}
