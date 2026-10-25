"use client";
import { useId, useState } from "react";
import { askRace } from "@/lib/api";
import type { AskResponse } from "@/lib/types";
import { Markdown } from "./Markdown";
import { ErrorBox, Panel, SectionLabel, Skeleton, SourceList, buttonClass, inputClass } from "./ui";

const EXAMPLES = ["Where does each candidate stand on housing?", "What does this office actually do?", "Who is funding each campaign?"];

export function AskBox({ raceId }: { raceId: string }) {
  const [q, setQ] = useState("");
  const [state, setState] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [res, setRes] = useState<AskResponse | null>(null);
  const [error, setError] = useState("");
  const id = useId();

  const ask = async (question: string) => {
    if (!question.trim()) return;
    setState("loading");
    try {
      setRes(await askRace({ raceId, question: question.trim() }));
      setState("ready");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
      setState("error");
    }
  };

  return (
    <Panel as="section" aria-labelledby={`${id}-h`} className="sm:p-6">
      <SectionLabel as="h2" id={`${id}-h`} tone="accent">
        Ask about this race
      </SectionLabel>
      <p className="mt-2 text-sm text-muted">Get a short, neutral, cited answer to a specific question.</p>
      <form
        className="mt-4 flex flex-col gap-2 sm:flex-row"
        onSubmit={(e) => {
          e.preventDefault();
          void ask(q);
        }}
      >
        <label htmlFor={`${id}-q`} className="sr-only">
          Your question
        </label>
        <div className="relative flex-1">
          <span aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 font-mono text-sm font-bold text-accent">
            &gt;
          </span>
          <input
            id={`${id}-q`}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Where does each candidate stand on housing?"
            className={`${inputClass} pl-8 font-mono text-sm`}
          />
        </div>
        <button type="submit" disabled={state === "loading" || !q.trim()} className={buttonClass("primary")}>
          {state === "loading" ? "Asking…" : "Ask"}
        </button>
      </form>
      <div className="mt-3 flex flex-wrap gap-2">
        {EXAMPLES.map((ex) => (
          <button
            key={ex}
            type="button"
            onClick={() => {
              setQ(ex);
              void ask(ex);
            }}
            className="rounded-chip border border-line-strong bg-bg px-2.5 py-1.5 text-left font-mono text-xs text-muted hover:border-accent hover:text-accent"
          >
            {ex}
          </button>
        ))}
      </div>
      <div aria-live="polite" className="mt-4">
        {state === "loading" && (
          <div role="status" className="space-y-2 rounded-[4px] border border-line bg-bg p-4">
            <span className="sr-only">Finding an answer</span>
            <p className="font-mono text-xs text-accent">
              <span className="bs-pulse">&#9646;</span> finding an answer&hellip;
            </p>
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-4/5" />
          </div>
        )}
        {state === "error" && <ErrorBox title="Couldn't answer that" message={error} onRetry={() => void ask(q)} />}
        {state === "ready" && res && (
          <div className="rounded-[4px] border border-line bg-bg p-4">
            <Markdown text={res.answer} sources={res.sources} />
            <SourceList sources={res.sources} />
            <p className="mt-3 font-mono text-xs text-muted">AI-generated ({res.model}). Verify with the cited sources.</p>
          </div>
        )}
      </div>
    </Panel>
  );
}
