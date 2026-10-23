"use client";
import Link from "next/link";
import type { BallotProvenance, Source } from "@/lib/types";

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`bs-skeleton ${className}`} aria-hidden="true" />;
}

export function PageSkeleton() {
  return (
    <div className="mx-auto max-w-6xl space-y-4 px-4 py-8" role="status" aria-label="Loading">
      <Skeleton className="h-8 w-1/3" />
      <Skeleton className="h-64 w-full" />
      <Skeleton className="h-24 w-full" />
    </div>
  );
}

export function ErrorBox({ title = "Something went wrong", message, onRetry }: { title?: string; message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-950">
      <p className="font-semibold">{title}</p>
      <p className="mt-1 text-sm">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-3 rounded-lg border border-amber-700 bg-white px-3 py-1.5 text-sm font-medium text-amber-950 hover:bg-amber-100"
        >
          Try again
        </button>
      )}
    </div>
  );
}

export function EmptyState({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-lg rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center">
      <p className="text-lg font-semibold text-slate-900">{title}</p>
      <div className="mt-2 text-sm text-slate-600">{children}</div>
      <Link href="/" className="mt-4 inline-block rounded-lg bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800">
        Find my ballot
      </Link>
    </div>
  );
}

export function PartyBadge({ party }: { party?: string }) {
  if (!party) return null;
  return <span className="rounded-full border border-slate-300 bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">{party}</span>;
}

export function ProvenanceBadge({ provenance }: { provenance: BallotProvenance }) {
  const official = provenance === "official-seed";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium ${
        official ? "border-teal-300 bg-teal-50 text-teal-900" : "border-amber-300 bg-amber-50 text-amber-950"
      }`}
    >
      <span aria-hidden="true">{official ? "✓" : "⚠"}</span>
      {official ? "Verified from official election records" : "AI-compiled from cited sources — verify"}
    </span>
  );
}

/** Numbered citation chips. `indexes` are zero-based positions into `sources`. */
export function Cites({ indexes, sources }: { indexes: number[]; sources: Source[] }) {
  const valid = indexes.filter((i) => sources[i]);
  if (!valid.length) return null;
  return (
    <span className="ml-1 inline-flex flex-wrap gap-1 align-baseline">
      {valid.map((i) => (
        <a
          key={i}
          href={sources[i].url}
          target="_blank"
          rel="noopener noreferrer"
          title={sources[i].title}
          aria-label={`Source ${i + 1}: ${sources[i].title}`}
          className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-teal-50 px-1.5 text-[11px] font-semibold text-teal-900 ring-1 ring-teal-300 hover:bg-teal-100"
        >
          {i + 1}
        </a>
      ))}
    </span>
  );
}

export function SourceList({ sources }: { sources: Source[] }) {
  if (!sources.length) return null;
  return (
    <div className="mt-4 border-t border-slate-200 pt-3">
      <h4 className="text-sm font-semibold text-slate-900">Sources</h4>
      <ol className="mt-2 space-y-1 text-sm">
        {sources.map((s, i) => (
          <li key={i} className="flex gap-2">
            <span className="w-5 shrink-0 text-right font-medium text-slate-600">{i + 1}.</span>
            <a href={s.url} target="_blank" rel="noopener noreferrer" className="break-words text-teal-800 underline underline-offset-2 hover:text-teal-950">
              {s.title}
            </a>
          </li>
        ))}
      </ol>
    </div>
  );
}
