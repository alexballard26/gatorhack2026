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
| 1 | Scaffold Next.js app + shared types | Opus | in progress |
| 2 | Geo: address → districts, boundary GeoJSON, `/api/districts` | Sonnet worker | pending |
| 3 | AI backend: Gemini client, cache, spend guard, ballot/candidate/research/ask routes | Sonnet worker | pending |
| 4 | UI: landing, map, ballot view, race view, research progress | Sonnet worker | pending |
| 5 | Alachua 2026 general ballot from official sources → seed JSON | Haiku assistant | pending |
| 6 | Integration + end-to-end test | Opus + worker | pending |
| 7 | Showcase Deep Research runs (≤ budget) | Opus | pending |

## Demo script
_TBD_
