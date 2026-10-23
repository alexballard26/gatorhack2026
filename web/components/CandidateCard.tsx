"use client";
import { useCallback, useId, useState } from "react";
import { getCandidate } from "@/lib/api";
import type { Candidate, CandidateProfile, ProfileItem } from "@/lib/types";
import { Cites, ErrorBox, PartyBadge, Skeleton, SourceList } from "./ui";

function Items({ title, items, sources }: { title: string; items?: ProfileItem[]; sources: CandidateProfile["sources"] }) {
  if (!items?.length) return null;
  return (
    <section className="mt-4">
      <h4 className="text-sm font-bold uppercase tracking-wide text-slate-700">{title}</h4>
      <dl className="mt-2 space-y-2">
        {items.map((it, i) => (
          <div key={i}>
            <dt className="text-sm font-semibold text-slate-900">{it.label}</dt>
            <dd className="text-slate-800">
              {it.text}
              <Cites indexes={it.sourceIndexes} sources={sources} />
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

export function CandidateCard({ raceId, candidate }: { raceId: string; candidate: Candidate }) {
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
    <li className="rounded-xl border border-slate-200 bg-white">
      <h3>
        <button
          onClick={toggle}
          aria-expanded={open}
          aria-controls={panelId}
          className="flex w-full items-center justify-between gap-3 rounded-xl p-4 text-left hover:bg-slate-50"
        >
          <span className="flex flex-wrap items-center gap-2">
            <span className="text-lg font-semibold text-slate-900">{candidate.name}</span>
            <PartyBadge party={candidate.party} />
            {candidate.incumbent && (
              <span className="rounded-full border border-teal-300 bg-teal-50 px-2 py-0.5 text-xs font-medium text-teal-900">Incumbent</span>
            )}
          </span>
          <span className="flex shrink-0 items-center gap-1 text-sm font-medium text-teal-800">
            {open ? "Hide" : "Profile"}
            <span aria-hidden="true" className={`transition-transform ${open ? "rotate-180" : ""}`}>
              &#9662;
            </span>
          </span>
        </button>
      </h3>
      <div id={panelId} hidden={!open} className="border-t border-slate-200 p-4">
        {state === "loading" && (
          <div role="status" aria-live="polite">
            <p className="mb-3 text-sm text-slate-700">Researching {candidate.name}&hellip; this can take 5 to 20 seconds the first time.</p>
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
            <p className="text-slate-800">{profile.summary}</p>
            <Items title="Background" items={profile.background} sources={profile.sources} />
            <Items title="Positions" items={profile.positions} sources={profile.sources} />
            <Items title="Endorsements" items={profile.endorsements} sources={profile.sources} />
            <Items title="Funding" items={profile.funding} sources={profile.sources} />
            {profile.website && (
              <p className="mt-4 text-sm">
                <a href={profile.website} target="_blank" rel="noopener noreferrer" className="font-medium text-teal-800 underline underline-offset-2">
                  Campaign website &#8599;
                </a>
              </p>
            )}
            <SourceList sources={profile.sources} />
            <p className="mt-3 text-xs text-slate-600">
              AI-generated summary ({profile.model}
              {profile.cached ? ", cached" : ""}). Verify with the cited sources.
            </p>
          </div>
        )}
        <p className="mt-3 text-xs text-slate-600">
          On the ballot per{" "}
          <a href={candidate.source.url} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
            {candidate.source.title}
          </a>
        </p>
      </div>
    </li>
  );
}
