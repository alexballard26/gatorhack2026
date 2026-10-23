# Cost Estimate — Nationwide Rollout (Nov 3, 2026 general)

Checked 2026-10-23. Rough order-of-magnitude, for the pitch and for planning. Not a quote.

## Inputs
**Deep Research agent (verified, ai.google.dev/gemini-api/docs/deep-research — Google's own preview estimates, "subject to change"):**
| Model | Per task | Typical usage |
|---|---|---|
| `deep-research-preview-04-2026` | **$1–3** | ~80 searches, ~250k input tokens, ~60k output |
| `deep-research-max-preview-04-2026` | $3–7 | ~160 searches, ~900k input, ~80k output |
Runs take minutes (often up to ~20 min). No published concurrency limit; spend tiers cap billing (Tier 1 = $250 cap, Tier 3 = $20k–100k+).

**Gemini 3.8 Flash (verified, pricing page):** $0.75 / $3.75 per 1M input/output tokens through Dec 31, 2026; Batch 50% off. Google Search grounding: 5,000 free/month, then $14 per 1,000.

**Scope of the Nov 3 ballot (Ballotpedia / BallotReady; local totals are our estimate):**
| Level | Races | Est. candidates |
|---|---|---|
| U.S. House + Senate | 435 + 35 | ~1,200 |
| Governors (36) + other statewide | ~300 | ~800 |
| State legislative seats | 6,137 | ~11,000 |
| Local (school board, city, county, judicial, special districts) | ~60k–100k (est.) | ~90k–180k (est.) |
| Statewide ballot measures | 145 | — |
| **Total** | **~70k–110k** | **~100k–200k (mid ≈ 150k)** |
No national candidate total is published; local races dominate and are the biggest uncertainty.

## One-time research cost (one dossier per candidate)
| Approach | Math | Cost |
|---|---|---|
| A. Deep Research for every candidate | 150k × $1–3 | **$150k–450k** (range $100k–600k) |
| B. Deep Research Max for every candidate | 150k × $3–7 | $450k–1.05M |
| C. **One Deep Research run per race** (all candidates compared in one report) | ~80k races × $1–3 | **$80k–240k** |
| D. **Hybrid:** Deep Research for federal/statewide/state-leg (~13k candidates); Flash + Search grounding for local (~140k × ~$0.20) | $13k–39k + ~$28k | **≈ $40k–70k** |

Flash-grounded dossier ≈ $0.20: ~10 grounded searches ($0.14) + ~50k input / 5k output tokens (~$0.06).

## Ongoing costs (not included above)
- **Refreshes** as news breaks: Flash refresh ≈ $0.20/candidate → ~$30k per full nationwide pass; refresh only competitive races.
- **Voter Q&A:** ≈ $0.02 per grounded question → 1M users × 3 questions ≈ $60k.
- **Candidate-list data:** the real bottleneck. BallotReady / Ballotpedia / Democracy Works licenses are quote-only (unknown).
- **Human neutrality review:** likely the largest real-world cost; not estimated.
- Map and district lookup: MapLibre + Census Geocoder are free; hosting is small.

## Throughput
150k runs × ~15 min ÷ 100 concurrent ≈ 16 days of continuous running → start ≥ 1 month before an election, and needs a high spend tier.

## Hackathon demo
One county (e.g. Alachua, ~30 races / ~75 candidates) with Deep Research ≈ **$75–225**; a handful of showcase races ≈ $20–50. Mind the Tier 1 $250 billing cap.
