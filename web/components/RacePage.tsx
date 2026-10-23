"use client";
import { useEffect } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { parseQuery } from "@/lib/api";
import { useBallotData } from "./useBallotData";
import { CandidateCard } from "./CandidateCard";
import { ResearchPanel } from "./ResearchPanel";
import { AskBox } from "./AskBox";
import { EmptyState, ErrorBox, ProvenanceBadge, Skeleton } from "./ui";

export function RacePage({ raceId }: { raceId: string }) {
  const sp = useSearchParams();
  const qs = sp.toString();
  const data = useBallotData(parseQuery(sp));
  const race = data.ballot?.races.find((r) => r.id === raceId);

  const raceTitle = race?.title;
  useEffect(() => {
    document.title = raceTitle ? `${raceTitle} | BallotScout` : "Race | BallotScout";
  }, [raceTitle]);

  if (data.status === "empty")
    return (
      <div className="px-4 py-12">
        <EmptyState title="Tell us where you vote">Open this race from your ballot so we know which districts you are in.</EmptyState>
      </div>
    );

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <Link href={`/ballot?${qs}`} className="text-sm font-medium text-teal-800 underline underline-offset-2">
        &larr; Back to my ballot
      </Link>

      {data.status === "loading" && (
        <div role="status" className="mt-4 space-y-3">
          <span className="sr-only">Loading race</span>
          <Skeleton className="h-9 w-2/3" />
          <Skeleton className="h-5 w-1/2" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      )}
      {data.status === "error" && (
        <div className="mt-4">
          <ErrorBox title="We couldn't load this race" message={data.error ?? "Unknown error"} onRetry={data.retry} />
        </div>
      )}
      {data.status === "ready" && !race && (
        <div className="mt-6">
          <EmptyState title="Race not found">That race isn&apos;t on this ballot.</EmptyState>
        </div>
      )}

      {race && data.ballot && (
        <div className="mt-4 space-y-6">
          <header>
            <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">{race.title}</h1>
            {race.description && <p className="mt-1 text-slate-700">{race.description}</p>}
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <ProvenanceBadge provenance={data.ballot.provenance} />
              {data.ballot.verifyUrl && (
                <a href={data.ballot.verifyUrl} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-teal-800 underline underline-offset-2">
                  Verify on your official sample ballot &#8599;
                </a>
              )}
            </div>
          </header>

          {race.measureSummary && (
            <section aria-label="Ballot summary" className="rounded-xl border border-slate-200 bg-white p-5">
              <h2 className="font-semibold text-slate-900">{race.kind === "retention" ? "Retention question" : "Ballot summary"}</h2>
              <p className="mt-1 text-slate-800">{race.measureSummary}</p>
            </section>
          )}

          {race.candidates.length > 0 && (
            <section aria-labelledby="cands">
              <h2 id="cands" className="mb-2 text-lg font-semibold text-slate-900">
                Candidates{race.seats && race.seats > 1 ? ` (vote for up to ${race.seats})` : ""}
              </h2>
              <p className="mb-3 text-sm text-slate-700">Listed in the order provided by the source. Expand a candidate for a cited profile.</p>
              <ul className="space-y-3">
                {race.candidates.map((c) => (
                  <CandidateCard key={c.id} raceId={race.id} candidate={c} />
                ))}
              </ul>
            </section>
          )}

          <ResearchPanel raceId={race.id} />
          <AskBox raceId={race.id} />
        </div>
      )}
    </div>
  );
}
