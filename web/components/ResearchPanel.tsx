"use client";
import { useEffect, useState } from "react";
import { getResearch, startResearch } from "@/lib/api";
import type { ResearchJob } from "@/lib/types";
import { Markdown } from "./Markdown";
import { ErrorBox, SourceList } from "./ui";

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

export function ResearchPanel({ raceId }: { raceId: string }) {
  const [job, setJob] = useState<ResearchJob | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [tick, setTick] = useState(0);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    let off = false;
    getResearch(raceId)
      .then((j) => !off && setJob(j))
      .catch(() => {});
    return () => {
      off = true;
    };
  }, [raceId]);

  const active = job?.status === "queued" || job?.status === "running";

  useEffect(() => {
    if (!active) return;
    const t = setTimeout(async () => {
      try {
        setJob(await getResearch(raceId));
        setErr("");
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Lost contact with the research agent; retrying…");
        setTick((n) => n + 1);
      }
    }, 5000);
    return () => clearTimeout(t);
  }, [active, job, tick, raceId]);

  const startedAt = job?.startedAt;
  useEffect(() => {
    if (!active) return;
    const base = startedAt ? new Date(startedAt).getTime() : Date.now();
    const iv = setInterval(() => setElapsed(Math.max(0, Math.round((Date.now() - base) / 1000))), 1000);
    return () => clearInterval(iv);
  }, [active, startedAt]);

  const start = async () => {
    setBusy(true);
    setErr("");
    try {
      setJob(await startResearch(raceId));
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not start research");
    } finally {
      setBusy(false);
    }
  };

  const status = job?.status ?? "not-started";
  const steps = job?.progress ?? [];

  return (
    <section aria-labelledby="dr-h" className="overflow-hidden rounded-xl border border-teal-300 bg-white">
      <div className="bg-teal-50 px-5 py-4">
        <p className="text-xs font-bold uppercase tracking-wider text-teal-900">Powered by Gemini Deep Research</p>
        <h2 id="dr-h" className="mt-1 text-xl font-semibold text-slate-900">
          Deep Research this race
        </h2>
        <p className="mt-1 text-sm text-slate-700">
          An AI research agent reads candidate sites, filings and news for several minutes, then writes a neutral, cited comparison.
        </p>
      </div>
      <div className="p-5">
        {(status === "not-started" || (status === "failed" && !busy)) && (
          <>
            {status === "failed" && (
              <div className="mb-3">
                <ErrorBox title="The research run failed" message={job?.error ?? "The agent could not finish. You can try again."} />
              </div>
            )}
            <button
              onClick={start}
              disabled={busy}
              className="rounded-lg bg-teal-700 px-5 py-2.5 font-semibold text-white hover:bg-teal-800 disabled:bg-slate-300 disabled:text-slate-600"
            >
              {busy ? "Starting…" : status === "failed" ? "Try again" : "Start deep research"}
            </button>
            <p className="mt-2 text-xs text-slate-600">Takes a few minutes. Results are saved so the next voter sees them instantly.</p>
          </>
        )}

        {status === "budget-blocked" && (
          <div role="status" className="rounded-lg border border-slate-300 bg-slate-50 p-4 text-sm text-slate-800">
            <p className="font-semibold">Deep research is paused</p>
            <p className="mt-1">
              We&apos;ve reached our research budget for now, so new reports can&apos;t be started. Candidate profiles and the Ask box below still work.
            </p>
          </div>
        )}

        {active && (
          <div aria-live="polite">
            <div className="flex items-center justify-between">
              <p className="font-semibold text-slate-900">{status === "queued" ? "Queued…" : "Researching…"}</p>
              <p className="text-sm tabular-nums text-slate-700">Elapsed {fmt(elapsed)}</p>
            </div>
            <ol className="mt-3 space-y-3 border-l-2 border-teal-200 pl-4" aria-label="Research progress">
              {steps.map((s, i) => {
                const current = i === steps.length - 1;
                return (
                  <li key={i} className="relative text-sm text-slate-800">
                    <span
                      aria-hidden="true"
                      className={`absolute -left-[1.45rem] top-1 h-3 w-3 rounded-full border-2 border-teal-700 ${current ? "bs-pulse bg-teal-200" : "bg-teal-700"}`}
                    />
                    {s}
                  </li>
                );
              })}
              <li className="relative text-sm text-slate-600">
                <span aria-hidden="true" className="bs-pulse absolute -left-[1.45rem] top-1 h-3 w-3 rounded-full border-2 border-slate-300 bg-white" />
                {steps.length ? "Working on the next step…" : "Starting the research agent…"}
              </li>
            </ol>
            {err && <p className="mt-3 text-sm text-amber-900">Having trouble checking progress ({err}). Retrying automatically.</p>}
          </div>
        )}

        {status === "completed" && job?.reportMarkdown && (
          <div>
            <details className="mb-4 text-sm text-slate-700">
              <summary className="cursor-pointer font-medium">How this report was researched ({steps.length} steps)</summary>
              <ol className="mt-2 list-decimal space-y-1 pl-6">
                {steps.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ol>
            </details>
            <article>
              <Markdown text={job.reportMarkdown} sources={job.sources ?? []} />
            </article>
            <SourceList sources={job.sources ?? []} />
            <p className="mt-3 text-xs text-slate-600">
              AI-generated by Gemini Deep Research{job.cached ? " (cached)" : ""}. Verify claims with the cited sources and your official sample ballot.
            </p>
          </div>
        )}

        {err && !active && status !== "failed" && <div className="mt-3"><ErrorBox message={err} onRetry={start} /></div>}
      </div>
    </section>
  );
}
