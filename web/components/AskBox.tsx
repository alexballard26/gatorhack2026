"use client";
import { useId, useState } from "react";
import { askRace } from "@/lib/api";
import type { AskResponse } from "@/lib/types";
import { Markdown } from "./Markdown";
import { ErrorBox, Skeleton, SourceList } from "./ui";

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
    <section aria-labelledby={`${id}-h`} className="rounded-xl border border-slate-200 bg-white p-5">
      <h2 id={`${id}-h`} className="text-lg font-semibold text-slate-900">
        Ask about this race
      </h2>
      <p className="mt-1 text-sm text-slate-700">Get a short, neutral, cited answer to a specific question.</p>
      <form
        className="mt-3 flex flex-col gap-2 sm:flex-row"
        onSubmit={(e) => {
          e.preventDefault();
          void ask(q);
        }}
      >
        <label htmlFor={`${id}-q`} className="sr-only">
          Your question
        </label>
        <input
          id={`${id}-q`}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Where does each candidate stand on housing?"
          className="w-full rounded-lg border border-slate-400 px-3 py-2.5 placeholder:text-slate-500 focus:border-teal-700"
        />
        <button
          type="submit"
          disabled={state === "loading" || !q.trim()}
          className="rounded-lg bg-teal-700 px-5 py-2.5 font-semibold text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-600"
        >
          Ask
        </button>
      </form>
      <div className="mt-2 flex flex-wrap gap-2">
        {EXAMPLES.map((ex) => (
          <button
            key={ex}
            type="button"
            onClick={() => {
              setQ(ex);
              void ask(ex);
            }}
            className="rounded-full border border-slate-300 bg-slate-50 px-3 py-1 text-sm text-slate-800 hover:border-teal-600 hover:bg-white"
          >
            {ex}
          </button>
        ))}
      </div>
      <div aria-live="polite" className="mt-4">
        {state === "loading" && (
          <div role="status" className="space-y-2">
            <span className="sr-only">Finding an answer</span>
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-4/5" />
          </div>
        )}
        {state === "error" && <ErrorBox title="Couldn't answer that" message={error} onRetry={() => void ask(q)} />}
        {state === "ready" && res && (
          <div>
            <Markdown text={res.answer} sources={res.sources} />
            <SourceList sources={res.sources} />
            <p className="mt-2 text-xs text-slate-600">AI-generated ({res.model}). Verify with the cited sources.</p>
          </div>
        )}
      </div>
    </section>
  );
}
