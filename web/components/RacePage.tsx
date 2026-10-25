"use client";
import { useEffect } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { parseQuery } from "@/lib/api";
import { useBallotData } from "./useBallotData";
import { CandidateCard } from "./CandidateCard";
import { ResearchPanel } from "./ResearchPanel";
import { AskBox } from "./AskBox";
import { Chip, EmptyState, ErrorBox, ProvenanceBadge, SectionLabel, Skeleton, Panel } from "./ui";

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
    <div className="mx-auto max-w-[1100px] px-4 py-6 sm:px-6 sm:py-8">
      <Link href={`/ballot?${qs}`} className="inline-flex min-h-9 items-center font-mono text-xs font-bold uppercase tracking-[0.1em] text-muted no-underline hover:text-accent">
        <span aria-hidden="true" className="mr-2">&larr;</span>Back to my ballot
      </Link>

      {data.status === "loading" && (
        <div role="status" className="mt-4 space-y-3">
          <span className="sr-only">Loading race</span>
          <Skeleton className="h-10 w-2/3" />
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
        <div className="mt-5 space-y-8">
          <header>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <SectionLabel tone="accent">Race</SectionLabel>
              {race.level && <Chip>{String(race.level).toUpperCase()}</Chip>}
              <Chip>{race.candidates.length} {race.candidates.length === 1 ? "candidate" : "candidates"}</Chip>
            </div>
            <h1 className="bs-display text-[clamp(30px,5vw,52px)] text-ink">{race.title}</h1>
            {race.description && <p className="mt-3 max-w-2xl text-[17px] leading-relaxed text-muted">{race.description}</p>}
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <ProvenanceBadge provenance={data.ballot.provenance} />
              {data.ballot.verifyUrl && (
                <a href={data.ballot.verifyUrl} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-accent underline underline-offset-4">
                  Verify on your official sample ballot &#8599;
                </a>
              )}
            </div>
          </header>

          {race.measureSummary && (
            <Panel as="section" aria-label="Ballot summary">
              <SectionLabel as="h2" tone="accent">{race.kind === "retention" ? "Retention question" : "Ballot summary"}</SectionLabel>
              <p className="mt-2 text-ink">{race.measureSummary}</p>
            </Panel>
          )}

          {race.candidates.length > 0 && (
            <section aria-labelledby="cands">
              <SectionLabel as="h2" id="cands" tone="accent">
                Candidates{race.seats && race.seats > 1 ? ` (vote for up to ${race.seats})` : ""}
              </SectionLabel>
              <p className="mb-4 mt-2 text-sm text-muted">Listed in the order provided by the source. Expand a candidate for a cited profile.</p>
              <ul className="space-y-3">
                {race.candidates.map((c, i) => (
                  <CandidateCard key={c.id} raceId={race.id} candidate={c} index={i + 1} />
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
