"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getDistricts, parseQuery } from "@/lib/api";
import type { Race } from "@/lib/types";
import { useBallotData } from "./useBallotData";
import { useCountdown } from "./countdown";
import { MapLazy } from "./MapLazy";
import type { MapStage } from "./MapView";
import { DistrictChangeNotice, LocationSummary, locationLabels } from "./LocationSummary";
import { Chip, EmptyState, ErrorBox, LiveDot, PartyBadge, Panel, ProvenanceBadge, SectionLabel, Skeleton, buttonClass } from "./ui";

const GROUPS: { title: string; match: (r: Race) => boolean }[] = [
  { title: "Federal", match: (r) => r.kind === "candidate" && r.level === "federal" },
  { title: "State", match: (r) => r.kind !== "measure" && r.level === "state" },
  { title: "County", match: (r) => r.kind !== "measure" && r.level === "county" },
  {
    title: "Municipal, school & judicial",
    match: (r) => r.kind !== "measure" && ["municipal", "school", "judicial", "special-district"].includes(r.level),
  },
  { title: "Ballot measures", match: (r) => r.kind === "measure" },
];

const SHOWN = 4;

export function RaceRow({ race, qs }: { race: Race; qs: string }) {
  const kind =
    race.kind === "measure" ? "Measure" : race.kind === "retention" ? "Retention" : `${race.candidates.length} ${race.candidates.length === 1 ? "candidate" : "candidates"}`;
  const shown = race.candidates.slice(0, SHOWN);
  const more = race.candidates.length - shown.length;
  return (
    <li className="flex">
      <Link
        href={`/race/${encodeURIComponent(race.id)}?${qs}`}
        className="group flex w-full flex-col rounded-panel border border-line bg-panel p-4 no-underline hover:border-accent hover:bg-raised sm:px-5"
      >
        <div className="flex items-start justify-between gap-3">
          <h3 className="font-sans text-[17px] font-bold leading-snug text-ink">{race.title}</h3>
          <span className="shrink-0 rounded-chip border border-line-strong bg-bg px-2 py-0.5 font-mono text-xs font-bold text-muted">{kind}</span>
        </div>
        {race.description && <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-muted">{race.description}</p>}
        {shown.length > 0 ? (
          <ul className="mt-3 border-t border-line">
            {shown.map((c) => (
              <li key={c.name} className="flex items-center justify-between gap-3 border-b border-line py-1.5 text-[15px] text-ink">
                <span className="min-w-0 break-words">{c.name}</span>
                <PartyBadge party={c.party} />
              </li>
            ))}
            {more > 0 && <li className="py-1.5 font-mono text-xs text-muted">+{more} more</li>}
          </ul>
        ) : (
          race.measureSummary && <p className="mt-3 line-clamp-3 border-t border-line pt-3 text-sm text-muted">{race.measureSummary}</p>
        )}
        <span className="mt-auto pt-4 font-mono text-[13px] font-bold text-accent group-hover:underline group-hover:underline-offset-4">
          Open race <span aria-hidden="true">&rarr;</span>
        </span>
      </Link>
    </li>
  );
}

function CountdownChip() {
  const c = useCountdown();
  if (!c) return <Chip className="opacity-0">--</Chip>;
  return <Chip accent>{c.passed ? "Polls open" : `T-${c.days}d ${String(c.hours).padStart(2, "0")}h`}</Chip>;
}

export function BallotPage() {
  const router = useRouter();
  const sp = useSearchParams();
  const q = parseQuery(sp);
  const qs = sp.toString();
  const data = useBallotData(q);
  const [stage, setStage] = useState<MapStage>("district");
  const [stateAbbr, setStateAbbr] = useState<string | undefined>();
  const lookSeq = useRef(0);
  const locState = data.location?.state;
  const locLat = data.location?.lat;
  const locLng = data.location?.lng;
  // A new location always reopens the map at district stage
  useEffect(() => {
    lookSeq.current++;
    setStage("district");
    setStateAbbr(locState || undefined);
  }, [locState, locLat, locLng]);
  const onStateClick = async (lat: number, lng: number) => {
    const seq = ++lookSeq.current;
    try {
      const d = await getDistricts({ lat: lat.toFixed(5), lng: lng.toFixed(5) });
      if (seq !== lookSeq.current) return;
      setStateAbbr(d.location.state);
      setStage("state");
    } catch {
      /* clicked outside a US state: ignore */
    }
  };

  if (data.status === "empty")
    return (
      <div className="mx-auto max-w-[1360px] px-4 py-12 sm:px-6">
        <EmptyState title="Tell us where you vote">Enter an address, click the map, or choose your districts to see your ballot.</EmptyState>
      </div>
    );

  const loc = data.location;
  const labels = loc ? locationLabels(loc) : undefined;
  const point = loc?.lat != null && loc?.lng != null ? { lat: loc.lat, lng: loc.lng } : null;
  const cdNum = loc?.congressionalDistrict;
  const districtLabel = cdNum ? (cdNum === "AL" ? "At-large district" : `District ${cdNum}`) : undefined;
  const ballot = data.ballot;
  const loading = data.status === "loading";
  const editHref = loc
    ? `/?${new URLSearchParams({ mode: "manual", state: loc.state, county: loc.county ?? "", cd: loc.congressionalDistrict ?? "", sd: loc.stateSenateDistrict ?? "", hd: loc.stateHouseDistrict ?? "", place: loc.place ?? "" })}`
    : "/";
  const groups = ballot ? GROUPS.map((g) => ({ ...g, races: ballot.races.filter(g.match) })).filter((g) => g.races.length) : [];

  return (
    <div>
      {/* Stage: map is the hero. Desktop = map behind docked panels; mobile = map on top, panels stacked below. */}
      <section aria-label="Your districts and map" className="relative isolate border-b border-line lg:h-[700px]">
        <div className="relative h-[460px] border-b border-line sm:h-[480px] lg:absolute lg:inset-0 lg:z-0 lg:h-auto lg:border-b-0">
          <MapLazy
            bare
            boundaries={data.boundaries}
            point={point}
            labels={labels}
            draggablePin={Boolean(point)}
            stage={stage}
            stateAbbr={stateAbbr}
            districtLabel={districtLabel}
            onStageChange={(s) => {
              lookSeq.current++;
              setStage(s);
              if (s === "nation") setStateAbbr(undefined);
              else if (s === "state") setStateAbbr(locState || stateAbbr);
            }}
            onStateClick={onStateClick}
            onPointClick={(lat, lng) => router.replace(`/ballot?lat=${lat.toFixed(5)}&lng=${lng.toFixed(5)}`)}
            onStateJump={(abbr) => {
              setStateAbbr(abbr);
              setStage("state");
            }}
            leftInset={440}
            className="h-full min-h-72 w-full"
            ariaLabel="Dark map of your districts. Drag the pin or click the map to adjust your location. Use the breadcrumb to zoom out."
          />
        </div>

        <div className="pointer-events-none relative z-10 mx-auto flex max-w-[1360px] flex-col gap-4 px-4 py-4 sm:px-6 lg:h-full lg:flex-row lg:justify-between lg:py-6">
          <div className="flex flex-col gap-4 lg:w-[400px]">
            <Panel as="section" dock aria-labelledby="loc-h" className="pointer-events-auto">
              <div className="flex items-center justify-between gap-3">
                <SectionLabel tone="accent">{ballot?.electionName ?? "General election"}</SectionLabel>
                <CountdownChip />
              </div>
              <h1 id="loc-h" className="bs-display mt-3 text-[32px] text-ink">
                Your ballot
              </h1>
              {loc ? (
                <>
                  <p className="mt-2 text-[17px] font-bold leading-snug text-ink">{loc.address ?? "Election day: Tue, Nov 3, 2026"}</p>
                  <div className="mt-3">
                    <LocationSummary loc={loc} />
                  </div>
                  <p className="mt-3">
                    <Link href={editHref} className="font-mono text-[13px] font-bold text-accent underline underline-offset-4">
                      Edit districts
                    </Link>
                  </p>
                </>
              ) : (
                <div className="mt-3 space-y-2" role="status" aria-label="Finding your districts">
                  <Skeleton className="h-5 w-4/5" />
                  <Skeleton className="h-7 w-full" />
                </div>
              )}
            </Panel>

            {loc && (
              <div className="pointer-events-auto">
                <DistrictChangeNotice loc={loc} boundaries={data.boundaries} />
              </div>
            )}

            <Panel dock className="pointer-events-auto !p-3 sm:!p-3">
              {point ? (
                <p className="text-sm leading-relaxed text-muted">
                  Not quite right? Drag the pin or click the map to adjust. Addresses can be placed approximately, especially near district borders.
                </p>
              ) : (
                <p className="font-mono text-xs text-muted" role="status">
                  {loading && !data.boundaries
                    ? "Loading district boundaries…"
                    : !data.boundaries
                      ? "District boundaries are not available for this location."
                      : "Showing the districts you chose."}
                </p>
              )}
              {point && loading && !data.boundaries && <p className="mt-1 font-mono text-xs text-muted">Loading district boundaries&hellip;</p>}
              {point && data.status === "ready" && !data.boundaries && <p className="mt-1 font-mono text-xs text-muted">District boundaries are not available for this location.</p>}
            </Panel>
          </div>

          <div className="flex flex-col justify-end gap-4 lg:w-[360px] lg:pb-8">
            {loading && (
              <Panel dock className="pointer-events-auto" role="status" aria-live="polite">
                <p className="flex items-center gap-2 font-mono text-xs font-bold uppercase tracking-[0.12em] text-accent">
                  <LiveDot /> Working
                </p>
                <p className="mt-2 text-sm leading-relaxed text-muted">{data.stage}</p>
              </Panel>
            )}
            {data.status === "error" && (
              <div className="pointer-events-auto">
                <ErrorBox title="We couldn't load your ballot" message={data.error ?? "Unknown error"} onRetry={data.retry} />
              </div>
            )}
            {ballot && (
              <Panel as="section" dock aria-label="Where this ballot comes from" className="pointer-events-auto">
                <ProvenanceBadge provenance={ballot.provenance} />
                {ballot.verifyUrl && (
                  <p className="mt-3">
                    <a href={ballot.verifyUrl} target="_blank" rel="noopener noreferrer" className={buttonClass("ghost", "sm")}>
                      Verify on your official sample ballot <span aria-hidden="true">&#8599;</span>
                    </a>
                  </p>
                )}
              </Panel>
            )}
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-[1360px] px-4 py-10 sm:px-6 sm:py-12">
        {ballot?.notes && (
          <aside aria-labelledby="cov-h" className="mb-10 rounded-panel border border-line bg-panel p-4 sm:px-5">
            <SectionLabel as="h2" id="cov-h" className="mb-1.5">
              Coverage note
            </SectionLabel>
            <p className="max-w-[90ch] text-sm leading-relaxed text-muted">{Array.isArray(ballot.notes) ? ballot.notes.join(" ") : ballot.notes}</p>
          </aside>
        )}
        {loading && (
          <div role="status" aria-label="Loading your ballot" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="rounded-panel border border-line bg-panel p-5">
                <Skeleton className="h-5 w-2/3" />
                <Skeleton className="mt-3 h-4 w-full" />
                <Skeleton className="mt-4 h-24 w-full" />
              </div>
            ))}
          </div>
        )}
        {ballot && ballot.races.length === 0 && (
          <EmptyState title="No races found for this location">We couldn&apos;t find races for these districts yet. Check your official sample ballot.</EmptyState>
        )}
        {groups.map((g, gi) => (
          <section key={g.title} aria-labelledby={`g-${gi}`} className="mb-10 last:mb-0">
            <header className="mb-4 flex items-baseline gap-3 border-b border-line pb-3">
              <span aria-hidden="true" className="font-mono text-[13px] font-bold text-accent">
                {String(gi + 1).padStart(2, "0")}
              </span>
              <h2 id={`g-${gi}`} className="font-display text-2xl leading-tight tracking-[-0.02em] text-ink">
                {g.title}
              </h2>
              <span className="ml-auto font-mono text-xs text-muted">
                {g.races.length} {g.races.length === 1 ? "race" : "races"}
              </span>
            </header>
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {g.races.map((r) => (
                <RaceRow key={r.id} race={r} qs={qs} />
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
