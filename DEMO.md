# Demo Video — Talking Points (≤ 3:00)

**Before recording:** hard-refresh http://localhost:3000. Open County Commission District 4 once beforehand so everything is warm. Practice the clicks once.

## 0:00–0:20 · The problem (Impact)
- Election day is **Tue, Nov 3** — 8 days away.
- Most voters know who's running for governor. Almost nobody knows who's on the ballot for **county commission or school board** — so they skip those races or guess.
- Those down-ballot seats decide local taxes, schools and growth — and there's often no voter guide at all.
- "Election officials have a word for skipping a race: an **undervote**. We built **Undervote** so you never have to."

## 0:20–0:45 · Find your ballot (Design)
- Home page → **Choose districts → "Fill in Alachua County, FL" → Show my ballot**.
- (Optional, 5 s) Show the map: the US → Florida → your district — "a custom map built from official Census boundaries; it only zooms where you need it."
- Point at the badge: **"Verified from official election records"** — the ballot comes from the Alachua Supervisor of Elections sample ballot and the Florida Division of Elections, with a link to verify.
- "16 races — from U.S. Senate down to School Board and a Gainesville charter amendment."

## 0:45–1:05 · Quick profiles (Technical execution)
- Open **County Commissioner, District 4** → expand a candidate.
- "A neutral profile in seconds — Gemini Flash with Google Search grounding. Every line cites its source. No source, no claim."

## 1:05–1:55 · The new technology (challenge requirement — say all three)
- Scroll to **Deep Research** on the same race.
- **What it does:** "This is Google's **Gemini Deep Research agent**. It plans its own research, reads dozens of sources over several minutes, and writes a side-by-side comparison of every candidate."
- Show the counters (**31 sources · 46 steps**), the comparison table, a citation chip, the agent's research log.
- **What makes it recent:** "It was released to developers on **December 11, 2025** — it's still in preview. This kind of research for every local race wasn't possible a year ago."
- (Optional 5 s) Ask box: type a question → cited answer.

## 1:55–2:30 · Difficulties we faced (say these out loud)
- **Neutrality:** same template for every candidate, attributed claims, never recommends anyone.
- **Hallucinations:** candidates come from official records; AI claims need a source or they're dropped; a "verify with sources" note on every report.
- **Cost & speed:** a run takes ~8 minutes and ~$1–3, so we research **on demand and cache** — the first voter to open a race triggers it, everyone after gets it instantly and free. Nationwide that's **cents per voter**.
- **Data access:** election sites block automated access, so we anchor on official exports and sample ballots.

## 2:30–2:50 · Why it matters (Impact + Novelty)
- "Florida redrew 21 of its 28 congressional districts this May — voters need a current ballot, not last cycle's." (Optional: Tampa address shows "Your district changed.")
- "Every race, every candidate, cited — for the races nobody else covers."

## 2:50–3:00 · Close
- "Undervote. Know every name on your ballot."
- One honest line: "Built this weekend with AI agents — I directed the product, Claude Code agents wrote the code, and Gemini does the research."

## Don't
- Don't click **"Deep Research this race"** on a race without a report (it takes ~8 minutes and costs money). Races with reports ready: U.S. Senate, U.S. House 3, Governor, State Senate 6, County Commission 4, School Board 1.
- Don't say who you'd vote for or react to a candidate — keep it nonpartisan on camera.
- Don't promise county/city coverage outside Alachua — "Alachua today, the same pipeline scales statewide."
