# Undervote — Devpost

## Tagline
Know every name on your ballot — a nonpartisan, AI-researched guide to every race, down to school board.

## About the project (paste into Devpost)

## Inspiration
Election officials have a word for skipping a race: an **undervote**. It happens most in the races that shape daily life — county commission, school board, judges, local charter amendments — because there's almost nothing to read about them. Most voters know who's running for governor; few could name a single school board candidate. With Florida redrawing 21 of its 28 congressional districts in May 2026, many voters don't even know which races are on their ballot this year. We wanted one place that answers *what's on my ballot* and *who are these people* — neutrally, with a source for every claim.

## What it does
- **Find your ballot.** Enter an address, click the map, or choose your districts. A custom map zooms from the U.S. to your state to your district and shows your 2026 congressional, state senate and state house boundaries — and tells you if your congressional district changed under the new map.
- **Every race, verified.** For Alachua County we built the ballot from the Supervisor of Elections' official sample ballot and the Florida Division of Elections' qualified-candidate list: federal, statewide, legislative, judicial retention, constitutional amendments, **County Commission, School Board, and city charter amendments**.
- **Instant candidate profiles** with numbered citations.
- **Deep Research reports.** For any race, Google's Gemini Deep Research agent spends several minutes reading dozens of sources and writes a side-by-side comparison of every candidate — background, stated positions, record, funding, endorsements, and what couldn't be verified. Our County Commission District 4 report drew on 31 sources across 46 research steps.
- **Ask about this race** — follow-up questions answered from cited sources.

It never recommends a candidate. Every candidate gets the same structure and level of detail, and parties are shown as neutral labels — no red or blue.

## How we built it
- **Next.js 15 + TypeScript + Tailwind**, with all AI calls on the server.
- **Gemini Deep Research agent** via the Interactions API (background runs, polled for progress), and **Gemini Flash with Google Search grounding** for profiles and Q&A.
- **On-demand research with caching.** A race is researched the first time any voter opens it; everyone after gets the cached report instantly. A spend ledger enforces a hard budget and a run cap in code.
- **A custom SVG election map** built with `d3-geo` and Census cartographic boundaries (`us-atlas`), using the Albers USA projection so Alaska and Hawaii appear as insets. District shapes come from Census TIGERweb (120th Congress, 2026 state legislative districts) and are clipped to each state's shoreline. No map tiles — it renders instantly.
- **Design:** we generated four completely different visual directions, picked elements from them, and rebuilt the app as a dark "electoral console."
- **Process:** built with Claude Code as an orchestrator — a lead agent planned the work and directed AI coding agents for the backend, map and UI, while research assistants gathered rules, data sources and pricing. Every agent's output was run and reviewed before it was merged.

## Challenges we ran into
- **Neutrality.** Same template for every candidate, attributed claims ("according to her campaign site…"), no judgment words, and a "what we couldn't verify" section.
- **Hallucinations.** Candidate lists come from official records, not the model. AI-generated claims must carry a source or they're dropped.
- **Parsing a preview API.** Our first Deep Research run captured only half the report and none of its sources — the agent returns several output blocks, a generated chart, and a numbered source list. We rewrote the parser against the real response.
- **Cost and latency.** A run takes about 8 minutes and \$1–3, so we never pre-research everything. With on-demand caching, the cost per voter for a race is

$$\text{cost per voter} = \frac{C_{\text{run}}}{N_{\text{voters who open it}}} \approx \frac{\$3}{10{,}000} = \$0.0003$$

- **Election data access.** County election sites block automated tools, so we anchored on official exports and the official sample ballot.
- **Maps.** Our first map used a standard tile basemap; it loaded slowly, drew borders through lakes, and looked generic. We replaced it with our own SVG map built from Census boundaries.

## What makes the tech recent
Google released the **Gemini Deep Research agent** to developers on **December 11, 2025**, and it's still in preview (`deep-research-preview-04-2026`). Research at this depth for every local race wasn't practical a year ago. The data is new too: the 2026 congressional and state legislative district boundaries, including Florida's map signed May 4, 2026.

## Accomplishments we're proud of
- A complete, verified Alachua County ballot — including county and city races — with six precomputed Deep Research reports.
- A map that feels like part of the product, not a plugin.
- Cost control built into the architecture, not bolted on.

## What we learned
- Official sources first; AI fills gaps and is labeled as AI.
- Preview APIs need to be tested against real responses, not docs.
- Generating on demand and caching beats pre-generating everything.

## What's next
- Expand county and city races beyond Alachua, starting statewide in Florida.
- Spanish-language reports (Alachua's sample ballot is already bilingual).
- Refresh reports as news breaks, with human review of neutrality before wide release.

## Built with
Next.js, React, TypeScript, Tailwind CSS, Gemini Deep Research (Interactions API), Gemini Flash, Google Search grounding, d3-geo, TopoJSON, us-atlas, U.S. Census Geocoder, Census TIGERweb, OpenStreetMap Nominatim, Claude Code
