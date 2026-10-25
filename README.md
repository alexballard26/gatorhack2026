# Undervote

A nonpartisan voter guide for the November 3, 2026 general election. Enter an address, see your districts on a map, and get a neutral, cited report on every race on your ballot.

Built for Gator Hack V. The demo area is Alachua County, Florida. The architecture is designed to work nationwide.

![Undervote screenshot](docs/screenshot.png)
<!-- TODO: add screenshot at docs/screenshot.png -->

## Features

- **Address to districts.** Finds congressional, state senate, and state house districts (plus county and place where available) and draws them on a MapLibre map. The map pin can be dragged to correct an approximate match.
- **Ballot view.** Lists the races a voter can vote in. The verified Alachua seed ballot comes from the official Florida Division of Elections candidate export (16 races, 43 candidates). Other ballots can come from cached AI lists or live Gemini Flash lookups.
- **Race reports.** Gemini Deep Research writes a neutral, side-by-side, cited report for a race. It runs on demand the first time anyone opens the race, shows progress while it runs, and is cached for every later visitor.
- **Candidate cards.** Quick profiles with a summary, background, positions, and source links. Candidates without a source are not shown.
- **Ask a question.** Follow-up Q&A about a race or candidate, answered with sources.
- **Budget guard.** Every paid call is checked against `BUDGET_USD` and `MAX_DEEP_RESEARCH_RUNS` before it runs.
- **Mock mode.** `MOCK_AI=1` serves recorded test data, so the app can be run without API spend.

## Run it locally

Requires Node.js 18.18 or newer (developed on Node 24) and npm.

```bash
cd web
npm install
npm run dev
```

Open http://localhost:3000.

**API key.** Create a `.env` file in the repo root (not in `web/`). `web/next.config.ts` loads the root `.env`, so the key stays on the server.

```bash
# /Users/.../Gatorhack 2026/.env
GEMINI_API_KEY=your-key-here
```

**No key? Use mock mode.** Add `MOCK_AI=1` to the same `.env` file, or set it in your shell. Mock mode reads `web/data/cache/mock/`.

## Environment variables

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `GEMINI_API_KEY` | Yes, unless `MOCK_AI=1` | none | Gemini API key. `GOOGLE_API_KEY` is also accepted. |
| `MOCK_AI` | No | off | Set to `1` to serve test data and skip live AI calls. |
| `GEMINI_FLASH_MODEL` | No | `gemini-3.8-flash` | Flash model for candidate lists, profiles, and Q&A. Falls back to `gemini-3-flash-preview`. [TODO: confirm model IDs] |
| `DEEP_RESEARCH_AGENT` | No | `deep-research-preview-04-2026` | Deep Research agent ID. |
| `BUDGET_USD` | No | `25` | Hard spend limit in USD. Calls that would exceed it are refused. |
| `MAX_DEEP_RESEARCH_RUNS` | No | `5` | Maximum Deep Research runs allowed. |

## Architecture

```
web/
  app/                   Next.js App Router pages and API routes
    api/districts        address or lat/lng to districts and boundaries
    api/ballot           races for a voter's districts
    api/candidate        candidate profile
    api/research         start (POST) and poll (GET) a Deep Research run
    api/ask              follow-up Q&A
    ballot/, race/[id]/  ballot and race pages
  components/            map, ballot, race, candidate, research, and Q&A UI
  lib/
    types.ts             shared contracts (Race, Candidate, Source, ResearchJob, ...)
    geo/                 Census Geocoder, TIGERweb, and Nominatim fallback
    ai/                  Gemini client (Interactions API and Flash), prompts,
                         cache, spend guard, mock responses
  data/
    ballots/             verified seed ballots (fl-alachua-2026.json)
    cache/               cached AI results (mock/ for mock mode)
    spend.json           spend ledger, created at runtime
```

Ballot source order: verified seed ballot, then cached AI list, then live Flash with search grounding.

## Data sources

- U.S. Census Geocoder: https://geocoding.geo.census.gov/geocoder/geographies (address matching, no key)
- Census TIGERweb (district boundaries): https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb
- OpenStreetMap Nominatim (fallback geocoder): https://nominatim.openstreetmap.org
- OpenFreeMap (map tiles): https://openfreemap.org
- Florida Division of Elections candidate export, 2026 general: https://dos.elections.myflorida.com/candidates/CanList.asp?elecid=20261103-GEN
- Florida constitutional amendments: https://constitutionalinitiatives.dos.fl.gov/
- Alachua County elections (verification link): https://www.votealachua.gov/
- Gemini Deep Research docs: https://ai.google.dev/gemini-api/docs/deep-research
- Gemini Interactions API: https://ai.google.dev/api/interactions-api

## Nonpartisan policy

- Undervote does not recommend or endorse candidates or positions.
- Every race and candidate profile uses the same structure and level of detail.
- Every claim links to a source. Candidates without a source are removed.
- Each ballot links to the official sample ballot so voters can verify it.
- AI-generated content is labeled as AI-generated.

## Limitations

- **Coverage.** Only Alachua County's state and federal races are in the seed ballot. County, municipal, school, and other local races are not included yet.
- **Candidate data.** The Alachua seed comes from a point-in-time export. Candidate lists and profiles can change.
- **AI output.** Reports and profiles are generated from web sources and checked for citations. They can still contain errors, so voters should verify with official sources.
- **Preview APIs.** Deep Research is in preview. Its response format may change, and runs can take several minutes.
- **Geocoding.** Address matching is approximate near district boundaries.
- **Storage.** Cache and spend data are local JSON files. There is no user accounts system and no hosted deployment yet. [TODO: confirm hosting plan]
- **Not official.** This is not an election authority. It is not voting or legal advice.
