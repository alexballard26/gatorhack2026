"use client";
import { useEffect, useMemo, useState } from "react";
import { getResearch, startResearch } from "@/lib/api";
import type { ResearchJob } from "@/lib/types";
import { Markdown, headingsOf, inline } from "./Markdown";
import { ErrorBox, LiveDot, SectionLabel, buttonClass } from "./ui";
import { SourceStream } from "./race/SourceStream";
import { fmtClock, pad2 } from "./race/util";


function parseStep(s: string): { title: string; body: string } {
  const m = /^\s*\*{1,3}([^*\n]+?)\*{1,3}\s*([\s\S]*)$/.exec(s);
  return m ? { title: m[1].trim(), body: m[2].trim() } : { title: "", body: s.trim() };
}

function StepNote({ step, compact }: { step: string; compact?: boolean }) {
  const { title, body } = parseStep(step);
  const [open, setOpen] = useState(false);
  const long = body.length > 130 || body.includes("\n");
  return (
    <div className="min-w-0">
      {title && <p className={`font-bold text-ink ${compact ? "text-sm" : "text-[14px]"}`}>{title}</p>}
      {body && (
        <p className={`text-[13.5px] leading-relaxed text-muted ${long && !open ? "line-clamp-2" : "whitespace-pre-line"}`}>{inline(body, [], "st")}</p>
      )}
      {long && (
        <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="font-mono text-xs font-bold text-accent underline underline-offset-4">
          {open ? "show less" : "show more"}
        </button>
      )}
    </div>
  );
}

/** Timestamped agent log. Timestamps are step ordinals (T+n) since steps carry no times. */
function AgentLog({ steps, live, scroll }: { steps: string[]; live?: boolean; scroll?: boolean }) {
  return (
    <ol aria-label="Research progress" className={`px-4 py-2 ${scroll ? "max-h-[340px] overflow-auto" : ""}`} tabIndex={scroll ? 0 : undefined}>
      {steps.map((s, i) => (
        <li key={i} className="grid grid-cols-[48px_1fr] gap-2 border-b border-line/60 py-2.5 last:border-0">
          <span className="font-mono text-xs leading-6 text-accent">{`#${pad2(i + 1)}`}</span>
          <StepNote step={s} compact={!live} />
        </li>
      ))}
      {live && (
        <li className="grid grid-cols-[48px_1fr] gap-2 py-2.5">
          <span className="bs-pulse font-mono text-xs leading-6 text-accent">&#9646;</span>
          <p className="text-[13.5px] text-muted">{steps.length ? "Working on the next step…" : "Starting the research agent…"}</p>
        </li>
      )}
    </ol>
  );
}

function Counter({ value, label }: { value: string; label: string }) {
  return (
    <div className="bg-bg px-3 py-3 text-center">
      <strong className="block font-mono text-2xl font-bold leading-none tabular-nums text-ink">{value}</strong>
      <span className="mt-1.5 block font-mono text-[11px] uppercase tracking-[0.14em] text-muted">{label}</span>
    </div>
  );
}

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
  const sources = job?.sources ?? [];
  const images = (job?.images ?? []).filter((u) => u.startsWith("data:image/"));
  const duration =
    job?.startedAt && job?.completedAt ? Math.max(0, Math.round((new Date(job.completedAt).getTime() - new Date(job.startedAt).getTime()) / 1000)) : null;
  const toc = useMemo(() => headingsOf(job?.reportMarkdown ?? ""), [job?.reportMarkdown]);

  return (
    <section aria-labelledby="dr-h" className="overflow-hidden rounded-panel border border-accent/50 bg-panel">
      <div className="border-b border-line px-4 py-5 sm:px-6">
        <SectionLabel tone="accent">Powered by Gemini Deep Research</SectionLabel>
        <h2 id="dr-h" className="bs-display mt-2 text-[clamp(26px,4vw,38px)] text-ink">
          Deep Research this race
        </h2>
        <p className="mt-3 max-w-2xl text-muted">
          An AI research agent reads candidate sites, filings and news for several minutes, then writes a neutral, cited comparison.
        </p>
        <p className="mt-3 font-mono text-xs text-muted">Gemini Deep Research agent &middot; released Dec 2025 &middot; reads dozens of sources over several minutes</p>
      </div>
      <div className="p-3 sm:p-6">
        {(status === "not-started" || (status === "failed" && !busy)) && (
          <>
            {status === "failed" && (
              <div className="mb-4">
                <ErrorBox title="The research run failed" message={job?.error ?? "The agent could not finish. You can try again."} />
              </div>
            )}
            <div className="grid gap-px overflow-hidden rounded-[4px] border border-line bg-line sm:grid-cols-3">
              {[
                ["01", "Reads", "Candidate sites, filings, news and records."],
                ["02", "Cross-checks", "Compares claims across independent sources."],
                ["03", "Reports", "A neutral comparison with numbered citations."],
              ].map(([n, t, d]) => (
                <div key={n} className="bg-bg p-4">
                  <p className="font-mono text-xs font-bold tracking-[0.12em] text-accent">{n}</p>
                  <p className="mt-1 font-bold text-ink">{t}</p>
                  <p className="mt-0.5 text-sm text-muted">{d}</p>
                </div>
              ))}
            </div>
            <div className="mt-5 flex flex-wrap items-center gap-4">
              <button onClick={start} disabled={busy} className={buttonClass("primary")}>
                {busy ? "Starting…" : status === "failed" ? "Try again" : "Start deep research"}
              </button>
              <p className="font-mono text-xs text-muted">Takes a few minutes. Results are saved so the next voter sees them instantly.</p>
            </div>
          </>
        )}

        {status === "budget-blocked" && (
          <div role="status" className="rounded-panel border border-warn/60 bg-warn-dim p-4 text-sm text-ink">
            <p className="font-mono text-xs font-bold uppercase tracking-[0.12em] text-warn">
              <span aria-hidden="true">{"! "}</span>Deep research is paused
            </p>
            <p className="mt-1.5 text-muted">
              We&apos;ve reached our research budget for now, so new reports can&apos;t be started. Candidate profiles and the Ask box below still work.
            </p>
          </div>
        )}

        {active && (
          <div aria-live="polite" className="overflow-hidden rounded-[4px] border border-line bg-bg">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
              <p className="flex items-center gap-2 font-mono text-xs font-bold uppercase tracking-[0.12em] text-accent">
                <LiveDot />
                {status === "queued" ? "Queued" : "Research running"}
              </p>
              <p className="font-mono text-xs tabular-nums text-muted">
                {sources.length} sources read &middot; {fmtClock(elapsed)} &middot; {steps.length} steps
              </p>
            </div>
            <AgentLog steps={steps} live scroll />
            {sources.length > 0 && (
              <div className="border-t border-line px-4 py-3">
                <SourceStream sources={sources} maxHeight="max-h-28" />
              </div>
            )}
            {err && <p className="border-t border-line px-4 py-3 font-mono text-xs text-warn">! Having trouble checking progress ({err}). Retrying automatically.</p>}
          </div>
        )}

        {status === "completed" && job?.reportMarkdown && (
          <div>
            <div className="grid grid-cols-3 gap-px overflow-hidden rounded-[4px] border border-line bg-line" role="group" aria-label="Research summary">
              <Counter value={String(sources.length)} label="Sources read" />
              <Counter value={String(steps.length)} label="Steps" />
              <Counter value={duration !== null ? fmtClock(duration) : "--"} label="Duration" />
            </div>
            {toc.length > 2 && (
              <nav aria-label="Report contents" className="mt-4 rounded-[4px] border border-line bg-bg p-4">
                <SectionLabel>In this report</SectionLabel>
                <ul className="mt-2 columns-1 gap-6 sm:columns-2">
                  {toc.map((t, i) => (
                    <li key={t.id} className="flex break-inside-avoid gap-3 py-1 text-sm">
                      <span aria-hidden="true" className="font-mono text-xs leading-5 text-faint">{pad2(i + 1)}</span>
                      <a href={`#${t.id}`} className="text-muted no-underline hover:text-accent hover:underline">
                        {t.title}
                      </a>
                    </li>
                  ))}
                </ul>
              </nav>
            )}
            <article className="mt-5 rounded-[4px] border border-line bg-bg p-3 sm:p-6">
              <Markdown text={job.reportMarkdown} sources={sources} />
            </article>
            {images.map((src, i) => (
              <figure key={i} className="mt-5">
                {/* Light card keeps light-background chart PNGs legible */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt="Chart generated by Gemini Deep Research" className="h-auto max-w-full rounded-[4px] border border-line-strong bg-white p-2" />
                <figcaption className="mt-1.5 font-mono text-xs text-muted">Chart generated by Gemini Deep Research{images.length > 1 ? ` (${i + 1} of ${images.length})` : ""}</figcaption>
              </figure>
            ))}
            {sources.length > 0 && (
              <details className="group mt-5 rounded-[4px] border border-line bg-bg">
                <summary className="cursor-pointer px-4 py-3 font-mono text-xs font-bold uppercase tracking-[0.12em] text-ink">
                  <span aria-hidden="true" className="mr-1.5 text-accent">{"//"}</span>Source list ({sources.length})
                </summary>
                <div className="border-t border-line px-4 py-3">
                  <SourceStream sources={sources} maxHeight="max-h-72" label="Domains read" />
                </div>
              </details>
            )}
            <details className="mt-3 rounded-[4px] border border-line bg-bg">
              <summary className="cursor-pointer px-4 py-3 font-mono text-xs font-bold uppercase tracking-[0.12em] text-ink">
                <span aria-hidden="true" className="mr-1.5 text-accent">{"//"}</span>How this report was researched ({steps.length} steps)
              </summary>
              <div className="border-t border-line">
                <AgentLog steps={steps} scroll />
              </div>
            </details>
            <p className="mt-4 font-mono text-xs text-muted">
              AI-generated by Gemini Deep Research{job.cached ? " (cached)" : ""}. Verify claims with the cited sources and your official sample ballot.
            </p>
          </div>
        )}

        {err && !active && status !== "failed" && <div className="mt-3"><ErrorBox message={err} onRetry={start} /></div>}
      </div>
    </section>
  );
}
