# BallotScout

## Short description

BallotScout is a nonpartisan voter guide for the November 3, 2026 general election. Enter your address and it finds your congressional, state senate, and state house districts on a map, then lists the races you can vote in. Each race gets a neutral, side-by-side report written by Google's Gemini Deep Research agent, the first time anyone opens it. The report is cached, so every later voter gets it free. Candidates without a source are dropped. The demo covers Alachua County, Florida, using the official Florida Division of Elections candidate list (16 races, 43 candidates). County and city races are not covered yet.

## Inspiration

Ballots are long, and the information about each candidate is spread across official sites, news coverage, and campaign pages. A voter first has to work out which districts they live in, then find the races that apply to them, then research each one. We wanted one place that does all three, with sources shown for every claim.

## What it does

- Takes an address and finds the voter's districts, shown on an interactive map.
- Lists every race on the voter's ballot, using the verified official seed ballot where one exists.
- Shows candidate lists and quick candidate profiles, each with a source link.
- Generates a full race report on demand: a neutral, cited comparison of every candidate, with progress shown while it runs.
- Answers follow-up questions with sources.

Every page follows the same neutrality rules. No candidate is recommended, and each one gets the same structure and level of detail.

## How we built it

BallotScout is a Next.js app (App Router, TypeScript, Tailwind CSS). The map uses MapLibre GL JS. Address lookup uses the U.S. Census Geocoder, with OpenStreetMap Nominatim as a fallback for addresses the Census geocoder misses. District boundaries come from Census TIGERweb.

AI work runs on the server, so the API key never reaches the browser. Deep Research runs use the Gemini Interactions API over REST, started in the background and polled for status. Candidate lists, profiles, and Q&A use Gemini Flash with Google Search grounding. Results are cached as JSON. A spend ledger enforces a hard budget (`BUDGET_USD`, default $25) and a run cap (`MAX_DEEP_RESEARCH_RUNS`, default 5). Each Deep Research run reserves a $3 estimate before it starts.

We built the project with Claude Code acting as an orchestrator. A lead agent planned the work, and it directed AI coding agents to write the code, build the UI, and check the data. The team checked each agent's output by running it and reading the diff.

## Challenges we ran into

- **Neutrality.** The prompts require identical structure for every candidate. Positions are attributed, and the output avoids judgment words.
- **Hallucination.** Every candidate must carry a source. Any candidate without one is dropped before the list reaches the voter.
- **Cost and latency.** A Deep Research run takes minutes. Google's published estimate is $1 to $3 per task. We cache each race once, and a hard budget guard stops runaway spend.
- **Candidate lists.** Official sources come first. AI-generated lists are a fallback. The Alachua County elections site blocks automated access, so county races are missing for now.
- **Geocoding near borders.** Address matching is approximate near district lines. The map pin can be dragged so the voter can correct the location.

## What makes the tech recent

The core technology is Google's Gemini Deep Research agent. Google made it available to developers through the Interactions API on December 11, 2025. It is still in preview, and the model ID we use is `deep-research-preview-04-2026`. The agent researches a whole race over several minutes and writes a cited comparison, which is a different job from a single chat answer.

The district data is recent too. Census TIGERweb includes the 120th Congress and the 2026 state legislative districts. Florida's new congressional map was signed on May 4, 2026.

## Accomplishments we're proud of

- A verified seed ballot for Alachua County: 16 races and 43 candidates, built from the official Florida Division of Elections export.
- An end-to-end path from address to districts to ballot, with a neutral, cited race view.
- A cache-first design. Each race is researched once, and the budget guard is enforced in code, not just in documentation.
- An offline mock mode (`MOCK_AI=1`), so the app can be demoed without spending API budget.

## What we learned

- Pre-generating every report is expensive. Generating on demand and caching the result is cheaper, and it means only races people actually open get researched.
- Official sources should be the starting point for any ballot data. AI should fill gaps, and it should be labeled as AI.
- Preview APIs change. Our Interactions API parser is written defensively for that reason.

## What's next

- Add county and municipal races, starting with Alachua, which needs a source the county site allows us to use.
- Run and publish showcase Deep Research reports for a handful of races.
- Deploy the app. Hosting is undecided, and a hosted version would need the cache and spend ledger moved to durable storage. [TODO: confirm hosting plan]
- Refresh candidate profiles when news breaks, and have a human review neutrality before wider use.
- Scale beyond one county. Our rough estimate for nationwide coverage is about $40k to $70k for one-time research, before refresh and support costs. [TODO: confirm estimate before pitch]

**Built with:** Next.js, React, TypeScript, Tailwind CSS, MapLibre GL JS, OpenFreeMap, Gemini Deep Research (Interactions API), Gemini Flash, Google Search grounding, U.S. Census Geocoder, Census TIGERweb, OpenStreetMap Nominatim, Claude Code
