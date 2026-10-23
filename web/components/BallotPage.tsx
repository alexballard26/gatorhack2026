"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { parseQuery } from "@/lib/api";
import type { Race } from "@/lib/types";
import { useBallotData } from "./useBallotData";
import { MapLazy } from "./MapLazy";
import { DistrictChangeNotice, LocationSummary, locationLabels } from "./LocationSummary";
import { EmptyState, ErrorBox, ProvenanceBadge, Skeleton } from "./ui";

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

export function RaceRow({ race, qs }: { race: Race; qs: string }) {
  const names = race.candidates.map((c) => c.name);
  const preview = names.length ? names.slice(0, 3).join(", ") + (names.length > 3 ? ` +${names.length - 3} more` : "") : race.measureSummary;
  const kind = race.kind === "measure" ? "Ballot measure" : race.kind === "retention" ? "Retention vote" : `${race.candidates.length} candidates`;
  return (
    <li>
      <Link
        href={`/race/${encodeURIComponent(race.id)}?${qs}`}
        className="group block rounded-xl border border-slate-200 bg-white p-4 hover:border-teal-600 hover:shadow-sm"
      >
        <div className="flex items-start justify-between gap-3">
          <h4 className="font-semibold text-slate-900 group-hover:text-teal-900">{race.title}</h4>
          <span className="shrink-0 text-teal-800" aria-hidden="true">
            &rarr;
          </span>
        </div>
        <p className="mt-0.5 text-xs font-medium uppercase tracking-wide text-slate-600">{kind}</p>
        {preview && <p className="mt-1 line-clamp-2 text-sm text-slate-700">{preview}</p>}
      </Link>
    </li>
  );
}

export function BallotPage() {
  const router = useRouter();
  const sp = useSearchParams();
  const q = parseQuery(sp);
  const qs = sp.toString();
  const data = useBallotData(q);

  if (data.status === "empty")
    return (
      <div className="px-4 py-12">
        <EmptyState title="Tell us where you vote">Enter an address, click the map, or choose your districts to see your ballot.</EmptyState>
      </div>
    );

  const labels = data.location ? locationLabels(data.location) : undefined;
  const point = data.location?.lat != null && data.location?.lng != null ? { lat: data.location.lat, lng: data.location.lng } : null;
  const ballot = data.ballot;

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">{ballot?.electionName ?? "Your ballot"}</h1>
        <p className="mt-1 text-slate-700">
          {data.location?.address ? `${data.location.address}` : "Election day: Tue, Nov 3, 2026"}
        </p>
        <div className="mt-3">{data.location ? <LocationSummary loc={data.location} /> : <Skeleton className="h-7 w-72" />}</div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <div className="lg:sticky lg:top-4 lg:order-2 lg:self-start">
          <MapLazy
            boundaries={data.boundaries}
            point={point}
            labels={labels}
            draggablePin={Boolean(point)}
            onPick={point ? (lat, lng) => router.replace(`/ballot?lat=${lat.toFixed(5)}&lng=${lng.toFixed(5)}`) : undefined} className="h-72 sm:h-96 lg:h-[28rem]" />
          {point && (
            <p className="mt-2 text-sm text-slate-700">
              Not quite right? Drag the pin or click the map to adjust. Addresses can be placed approximately, especially near district borders.
            </p>
          )}
          {data.location && (
            <p className="mt-1 text-sm">
              <Link
                href={`/?${new URLSearchParams({ mode: "manual", state: data.location.state, county: data.location.county ?? "", cd: data.location.congressionalDistrict ?? "", sd: data.location.stateSenateDistrict ?? "", hd: data.location.stateHouseDistrict ?? "", place: data.location.place ?? "" })}`}
                className="font-medium text-teal-800 underline underline-offset-2"
              >
                Edit districts
              </Link>
            </p>
          )}
          {data.status === "loading" && !data.boundaries && <p className="mt-2 text-sm text-slate-600">Loading district boundaries&hellip;</p>}
          {data.status === "ready" && !data.boundaries && <p className="mt-2 text-sm text-slate-600">District boundaries are not available for this location.</p>}
        </div>

        <div className="lg:order-1">
          {data.location && <DistrictChangeNotice loc={data.location} boundaries={data.boundaries} />}
          {data.status === "loading" && (
            <div role="status" aria-live="polite">
              <p className="mb-3 text-sm font-medium text-teal-900">{data.stage}</p>
              <div className="space-y-3">
                {[0, 1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-20 w-full" />
                ))}
              </div>
            </div>
          )}
          {data.status === "error" && <ErrorBox title="We couldn't load your ballot" message={data.error ?? "Unknown error"} onRetry={data.retry} />}
          {ballot && (
            <>
              <div className="mb-5 flex flex-wrap items-center gap-3">
                <ProvenanceBadge provenance={ballot.provenance} />
                {ballot.verifyUrl && (
                  <a
                    href={ballot.verifyUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-medium text-teal-800 underline underline-offset-2 hover:text-teal-950"
                  >
                    Verify on your official sample ballot &#8599;
                  </a>
                )}
              </div>
              {ballot.notes && (
                <p className="mb-5 rounded-lg border border-slate-300 bg-slate-100 p-3 text-sm text-slate-800">
                  <span className="font-semibold">Coverage note: </span>
                  {Array.isArray(ballot.notes) ? ballot.notes.join(" ") : ballot.notes}
                </p>
              )}
              {ballot.races.length === 0 && <EmptyState title="No races found for this location">We couldn&apos;t find races for these districts yet. Check your official sample ballot.</EmptyState>}
              {GROUPS.map((g) => {
                const rs = ballot.races.filter(g.match);
                if (!rs.length) return null;
                return (
                  <section key={g.title} aria-labelledby={`g-${g.title}`} className="mb-6">
                    <h3 id={`g-${g.title}`} className="mb-2 text-sm font-bold uppercase tracking-wider text-slate-700">
                      {g.title} <span className="font-normal text-slate-600">({rs.length})</span>
                    </h3>
                    <ul className="space-y-2">
                      {rs.map((r) => (
                        <RaceRow key={r.id} race={r} qs={qs} />
                      ))}
                    </ul>
                  </section>
                );
              })}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
