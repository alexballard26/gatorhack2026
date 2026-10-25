"use client";
import { useCallback, useId, useState } from "react";
import { getCandidate } from "@/lib/api";
import type { Candidate, CandidateProfile, ProfileItem } from "@/lib/types";
import { Chip, Cites, ErrorBox, PartyBadge, SectionLabel, Skeleton, SourceList } from "./ui";

function Items({ title, items, sources }: { title: string; items?: ProfileItem[]; sources: CandidateProfile["sources"] }) {
  if (!items?.length) return null;
  return (
    <section className="mt-5">
      <SectionLabel as="h4">{title}</SectionLabel>
      <dl className="mt-2 divide-y divide-line border-y border-line">
        {items.map((it, i) => (
          <div key={i} className="py-2.5">
            <dt className="text-sm font-bold text-ink">{it.label}</dt>
            <dd className="mt-0.5 leading-relaxed text-muted">
              {it.text}
              <Cites indexes={it.sourceIndexes} sources={sources} />
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

export function CandidateCard({ raceId, candidate, index }: { raceId: string; candidate: Candidate; index?: number }) {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [profile, setProfile] = useState<CandidateProfile | null>(null);
  const [error, setError] = useState("");
  const panelId = useId();

  const load = useCallback(async () => {
    setState("loading");
    try {
      setProfile(await getCandidate(raceId, candidate.id));
      setState("ready");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
      setState("error");
    }
  }, [raceId, candidate.id]);

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next && state === "idle") void load();
  };

  return (
    <li className={`rounded-panel border bg-panel ${open ? "border-line-strong" : "border-line"}`}>
      <h3>
        <button
          onClick={toggle}
          aria-expanded={open}
          aria-controls={panelId}
          className="flex w-full items-center justify-between gap-3 rounded-panel p-4 text-left hover:bg-raised sm:px-5"
        >
          <span className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1.5">
            {index !== undefined && (
              <span aria-hidden="true" className="font-mono text-xs font-bold text-faint">
                {String(index).padStart(2, "0")}
              </span>
            )}
            <span className="text-lg font-bold text-ink">{candidate.name}</span>
            <PartyBadge party={candidate.party} />
            {candidate.incumbent && <Chip accent>Incumbent</Chip>}
          </span>
          <span className="flex shrink-0 items-center gap-1.5 font-mono text-xs font-bold uppercase tracking-[0.1em] text-accent">
            {open ? "Hide" : "Profile"}
            <span aria-hidden="true" className={`transition-transform ${open ? "rotate-180" : ""}`}>
              &#9662;
            </span>
          </span>
        </button>
      </h3>
      <div id={panelId} hidden={!open} className="border-t border-line p-4 sm:p-5">
        {state === "loading" && (
          <div role="status" aria-live="polite" className="rounded-[4px] border border-line bg-bg p-4">
            <p className="mb-3 font-mono text-xs text-accent">
              <span className="bs-pulse">&#9646;</span> researching {candidate.name.toLowerCase()}&hellip; 5 to 20 s the first time
            </p>
            <div className="space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="mt-4 h-4 w-1/4" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          </div>
        )}
        {state === "error" && <ErrorBox title="Couldn't load this profile" message={error} onRetry={load} />}
        {state === "ready" && profile && (
          <div>
            <p className="text-[17px] leading-relaxed text-ink">{profile.summary}</p>
            <Items title="Background" items={profile.background} sources={profile.sources} />
            <Items title="Positions" items={profile.positions} sources={profile.sources} />
            <Items title="Endorsements" items={profile.endorsements} sources={profile.sources} />
            <Items title="Funding" items={profile.funding} sources={profile.sources} />
            {profile.website && (
              <p className="mt-4 text-sm">
                <a href={profile.website} target="_blank" rel="noopener noreferrer" className="font-medium text-accent underline underline-offset-4">
                  Campaign website &#8599;
                </a>
              </p>
            )}
            <SourceList sources={profile.sources} />
            <p className="mt-3 font-mono text-xs text-muted">
              AI-generated summary ({profile.model}
              {profile.cached ? ", cached" : ""}). Verify with the cited sources.
            </p>
          </div>
        )}
        <p className="mt-3 text-xs text-muted">
          On the ballot per{" "}
          <a href={candidate.source.url} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4 hover:text-accent">
            {candidate.source.title}
          </a>
        </p>
      </div>
    </li>
  );
}
