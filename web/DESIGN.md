# Undervote design system: "Map-First Mission Control"

Dark, calm, cartographic console. Flat bordered panels, the map as hero, mono data accents, the AI visibly at work.
Reference: `design/d-mission/index.html` (layout), `design/b-poster/index.html` (type). Tokens live in `app/globals.css` (`@theme`).

## Colors (Tailwind v4 classes work for bg-/text-/border-/ring-/divide-)
| Token | Hex | Classes | Use |
|---|---|---|---|
| bg | `#0B1210` | `bg-bg` | page, inputs, inset wells |
| panel | `#121C19` | `bg-panel` | cards/panels |
| raised | `#17241F` | `bg-raised` | hover/raised surface |
| line | `#243830` | `border-line` `divide-line` | default borders, dividers |
| line-strong | `#365248` | `border-line-strong` | chip/button/outlined borders |
| field | `#5E7D70` | `border-field` | form control borders (3:1+ on bg; used by `inputClass`) |
| ink | `#E9F0EA` | `text-ink` | primary text |
| muted | `#A5B7AE` | `text-muted` | secondary text (8:1 on panel) |
| faint | `#7F948A` | `text-faint` | placeholders, disabled, decorative only |
| accent | `#7CF29A` | `bg-accent` `text-accent` `border-accent` | phosphor green. Sparingly (below) |
| accent-ink | `#06210F` | `text-accent-ink` | text ON accent backgrounds |
| accent-dim | 12% accent | `bg-accent-dim` | active-state tint |
| warn | `#F2B544` | `text-warn` `border-warn` `bg-warn-dim` | errors AND warnings (amber, never red) |
| teal / lime | `#5FD4C4` / `#C8F7A0` | `text-teal` `text-lime` | map layer legend only |

Accent use: primary buttons, active tabs/states, citation numbers, section eyebrows, the district glow, the live-research indicator. Never red or blue. Party/candidate are never colored.

## Fonts
- `font-display` Archivo Black: page/section headings only. Use `.bs-display` (tracking -0.025em, line-height .98) or `font-display tracking-[-0.02em] leading-tight`. Sentence case, don't shout.
- `font-sans` Space Grotesk (default on body): UI and prose. 400/500/700.
- `font-mono` Space Mono: labels, counters, district chips, party labels, citation markers, timestamps, buttons in nav. Uppercase + `tracking-[0.14em]` only for micro-labels.

## Primitives (`components/ui.tsx`)
```tsx
<Panel>                       // flat bordered panel (bg-panel, rounded 6px, p-4/p-5)
<Panel raised dock as="section"> // raised surface / floating shadow for panels over the map
<SectionLabel>Election countdown</SectionLabel>   // renders "// ELECTION COUNTDOWN" (mono, muted). tone="accent" for eyebrows, as="h2"|"h3"|"h4"|"p"
<button className={buttonClass("primary" | "ghost" | "quiet", "md" | "sm")}>  // also works on <Link>
<input className={inputClass} /> <label className={fieldLabelClass}>      // dark field + mono label
<Chip>CD 3</Chip>  <Chip accent>2 sources</Chip>   // mono outlined chip (district codes, counts)
<PartyBadge party="Republican" />   // neutral outlined mono label
<ProvenanceBadge provenance={p} />  // green shield = official records; amber triangle = AI-compiled
<Cites indexes={[0,2]} sources={sources} />  // mono outlined numbered chips, accent digit, link out
<SourceList sources={sources} />
<LiveDot />                         // pulsing accent dot; use next to "Research running"
<ErrorBox title message onRetry />  // amber alert panel
<EmptyState title>...</EmptyState>, <Skeleton className="h-8 w-1/3" />, <PageSkeleton />
```
Also `components/countdown.ts`: `ELECTION_OPENS` (7:00 AM ET, Nov 3 2026 = `2026-11-03T07:00:00-05:00`), `computeCountdown()`, `useCountdown()` (null until mounted).

## Conventions
- Page container: `mx-auto max-w-[1360px] px-4 sm:px-6`. Section vertical rhythm `py-10`/`py-12`; gap between panels `gap-4`; 4px spacing scale.
- Panels: border `border-line`, radius 6px (`rounded-panel`), flat. Shadow (`shadow-dock`) only for panels floating over the map. Chips/buttons radius 3-4px. No gradients, no pill shapes.
- Headings: display font for h1/h2; h3 in `font-sans font-bold`. Eyebrow every major section with `<SectionLabel>`.
- Citation chips: `<Cites>`; in prose use the same look (`rounded-chip border border-line-strong bg-bg font-mono text-[11px] font-bold text-accent`). Numbered lists of sources use mono accent numbers.
- Party labels: `<PartyBadge>` only. Plain neutral outline, never colored by party.
- Links in prose: `text-accent underline underline-offset-4` (or muted with accent hover in dense lists).
- Focus: global 2px accent outline, 2px offset (already in globals; don't remove). Inputs also turn border accent on focus-visible.
- Errors/warnings: amber (`ErrorBox`, `text-warn`), prefix with `!`. Provide text, not just color.
- Motion: only pulse/ping/shimmer classes (`bs-pulse`, `bs-ping`, `bs-skeleton`); all disabled by the global `prefers-reduced-motion` rule.
- Old light-theme classes (`bg-white`, `text-slate-*`, `teal-*`, `amber-*`) will look wrong: replace with tokens.

## Map (`components/map/ElectionMap.tsx`, lazy via `ElectionMapLazy`)
Custom SVG cartography, no tile basemap and no MapLibre. `d3-geo` `geoAlbersUsa()` (AK/HI insets) fitted to a fixed 975x610 world frame; states from `us-atlas` (Census cartographic boundaries, already shoreline-clipped), counties served per state by `/api/counties?state=FL` (read from us-atlas on the server), incorporated places by `/api/places?bbox=` (TIGERweb, top 25 by population). Districts still come from `/api/districts`.
- Look: ocean = page background with a hairline graticule; land `#121C18` with a dot-matrix pattern; 1px coastline, hairline state borders; selected state gets an accent glow (blur filter, used sparingly); district = translucent accent fill + diagonal hatch + glow. Corner brackets, N compass tick, scale bar, mono readout (`STAGE 2/3 · FLORIDA · 67 COUNTIES`) and live cursor coordinates are the HUD. Labels: Space Grotesk for names, Space Mono for codes.
- Layers: congressional `#7CF29A` solid + glow; state senate `#5FD4C4` solid; state house `#C8F7A0` dashed; user county `#A5B7AE` dotted; old 2024 district `#8A9A92` dashed (off by default). District layers render inside a `<clipPath>` made from the state's us-atlas land shape, so every line and fill stops at the coast (TIGERweb district polygons include water). TIGERweb GeoJSON is re-wound (`rewindFeature`) because d3-geo is spherical.
- Camera: app-controlled, three stages `stage="nation" | "state" | "district"` (+ `stateAbbr`). No wheel, drag or pinch zoom: the page scrolls normally over the map (touch-action pan-y). Stage changes animate one transform (scale + translate on the world `<g>`, ~650 ms ease-in-out, center and log-scale interpolated; jump under `prefers-reduced-motion`). Strokes use `vector-effect: non-scaling-stroke`; patterns are counter-scaled so dots and hatch stay constant size. Labels, pin and HUD live in screen space (constant text size); labels fade out while the camera moves and are re-laid-out after.
- Interaction: nation = hover lifts a state (accent outline, mono tooltip), click zooms; state = neighbors dimmed, county hairlines + names (those that fit, greedy by area), hover highlights a county, click anywhere in the state inverts the projection and calls `onPointClick(lat,lng)`; district = pin (draggable when `draggablePin`), top places, click elsewhere moves the pin. A "Choose your state" `<select>` in the status bar is the keyboard path to states. Breadcrumb (`United States > Florida > District 3`) is the only way to zoom out; parents handle `onStageChange`.
- Props: `stage`, `stateAbbr`, `districtLabel`, `onStageChange`, `onStateSelect(abbr)`, `onPointClick(lat,lng)`, `boundaries`, `point`, `draggablePin`, `showLegend`, `labels`, `busy`, `className`, `ariaLabel`. The legend toggles and prompt ("Click near your home") sit in a status bar under the map, never over the geography. Layout: give the map its own region (desktop: sticky panel beside the content, `lg:h-full` inside a fixed-height wrapper; mobile: map above the panels, the component sets its own map-area height).

## Don'ts
No red/blue, no party colors, no accent as large text blocks or backgrounds beyond buttons, no `text-faint` for body text, no rounded-full pills, no emojis, no raw hex in components (use tokens), don't remove focus outlines.
