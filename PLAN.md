# Plan

_Owned by the orchestrator. Updated as tasks are assigned and verified._

## Idea / approach
**Working name:** BallotScout (rename anytime).

A voter enters their address (or picks districts / clicks the map) and sees every race on their Nov 3, 2026 ballot, on a map of their districts. Each race lists its candidates with neutral, cited profiles. Everything is **on-demand + cached**: a race is researched the first time any voter opens it; later viewers get the cached result.

**Core "new" technology:** Gemini **Deep Research agent** via the **Interactions API** (launched to developers Dec 11, 2025; current id `deep-research-preview-04-2026`). Produces a long, cited, side-by-side report per race. ~$1–3 per run, minutes per run.

**Supporting tech:**
- Gemini Flash (latest `gemini-3.8-flash`; fallback `gemini-3-flash-preview`) + Google Search grounding → candidate lists (on demand), quick candidate cards, follow-up Q&A. Structured JSON, source link per candidate, "verify on your official sample ballot" link.
- Census Geocoder (free, no key) → address → 120th Congressional + 2026 state legislative districts + county.
- Census TIGERweb (free) → district boundary GeoJSON for the map. MapLibre GL JS + OpenFreeMap tiles (free, no key).
- Florida's new congressional map (signed May 4, 2026) = secondary "fresh data" talking point.

Targets: Best Use of Gemini, Best AI Hack, Best Social Impact, main awards.

## Decisions (2026-10-23, from user)
- Demo area: **Alachua County, FL**. Architecture stays nationwide.
- Overnight API budget: **$25** max. Enforced in code (spend guard).
- May commit **and push** to `main` on GitHub overnight.
- Hosting: runs locally; keep deploy-ready (Vercel) — decide tomorrow.
- District input instead of ZIP is fine.

## Architecture
- `web/` — Next.js (App Router, TypeScript, Tailwind). Server API routes keep the Gemini key server-side.
- `web/lib/types.ts` — shared contracts (owned by orchestrator).
- `web/lib/geo/` + `app/api/districts` — geocoding, district lookup, boundaries.
- `web/lib/ai/` + `app/api/ballot`, `app/api/candidate`, `app/api/research`, `app/api/ask` — Gemini calls, prompts, cache, spend guard.
- `web/data/cache/` — JSON file cache (gitignored except curated showcase files). `web/data/ballots/` — verified seed ballots (Alachua).
- Ballot source priority: verified seed (official sample ballot) → cached AI list → live Flash + grounding.

## Tasks

| # | Task | Owner | Status |
|---|------|-------|--------|
| 1 | Scaffold Next.js app + shared types | Opus | done |
| 2 | Geo: address → districts, boundary GeoJSON, `/api/districts` | Sonnet worker | done, verified |
| 3 | AI backend: Gemini client, cache, spend guard, ballot/candidate/research/ask routes | Sonnet worker | done (mock-tested); **live untested — no API key** |
| 4 | UI: landing, map, ballot view, race view, research progress | Sonnet worker | done, verified in browser (desktop + mobile) |
| 5 | Alachua 2026 general ballot from official sources → seed JSON | Haiku → Opus | done: 16 races / 43 candidates from FL DOS export; **county + municipal races missing** (county site blocks bots) |
| 6 | Integration + end-to-end test | Opus | done on test data (address → map → ballot → race → profile → research) |
| 7 | Showcase Deep Research runs (≤ budget) | Opus | done: CD 3, U.S. Senate, Governor, State Senate 6 (25–35k chars, 35–50 sources each), committed as showcase |
| 8 | "Your district changed" (119th → 120th Congress) + map/title polish | Sonnet worker | done, verified (Tampa 14 → 12) |
| 9 | README + Devpost draft | Haiku assistant | done (DEVPOST.md, README.md) |

## Status — Fri Oct 23, evening
- Everything runs live: `cd web && npm run dev` → http://localhost:3000 (key in repo-root `.env`).
- Verified live: Flash candidate profile (~30 s, ~$0.03, 16 sources), Q&A (~14 s), Deep Research (~7–8 min per race).
- Showcase reports precomputed + committed: `fl-us-house-3`, `fl-us-senate`, `fl-governor`, `fl-state-senate-6`.
- Spend: ~$12 of $25 (Deep Research recorded at a flat $3 estimate per run; check the real number in Google Cloud Billing).
- Demo address: a Gainesville address in CD 3 / SD 6 (e.g. near UF) shows all four showcase races. Use a Tampa address for the "district changed" callout.
- Open: county/city races missing from the Alachua ballot; live AI ballots outside Alachua untested; hosting undecided.

## Demo script (3-minute video / finals pitch — draft)
1. **Hook (20 s):** "Election day is Nov 3. Most voters know who's running for governor. Almost nobody knows who's running for the seats further down the ballot, so they skip those races or guess. And in Florida, 21 of 28 congressional districts were redrawn this May."
2. **Locate (20 s):** type a Gainesville address → map shows the new 2026 districts → (if built) "Your district changed" callout.
3. **Ballot (20 s):** every race grouped by level, "Verified from official election records" badge, verify link.
4. **Profile (30 s):** open a race → expand a candidate → neutral summary, every line cited.
5. **The new tech (60 s):** click "Deep Research this race" on a *precomputed* race to show the finished report, and show the live progress timeline on one started on stage. Explain: Gemini Deep Research agent, released to developers Dec 11, 2025; reads dozens of sources over several minutes; we constrain it to a fixed neutral template with citations.
6. **Difficulties (20 s):** neutrality, hallucinations (no source → not shown), cost/latency → on-demand + cache: "we only pay to research a race the first time any voter opens it."
7. **Close (10 s):** cost at scale (~cents per voter, see COSTS.md), what's next (county races, more states, languages).

## Morning checklist (user)
- [ ] `.env` with `GEMINI_API_KEY` (billing on) — nothing live has run without it
- [ ] Confirm teammates (2–5 registered) — solo not eligible
- [ ] Ask an organizer about AI coding tools at check-in
- [ ] Optional: download Alachua's official 2026 sample ballot PDF from votealachua.gov so we can add county/city races
