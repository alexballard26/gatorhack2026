"use client";
import Link from "next/link";
import type { BallotProvenance, Source } from "@/lib/types";

/* ---------- class helpers (also usable on <Link>/<a>) ---------- */

type ButtonVariant = "primary" | "ghost" | "quiet";
type ButtonSize = "md" | "sm";

/** Class string for a button look. Use on <Link> as well: <Link className={buttonClass("ghost")}>. */
export function buttonClass(variant: ButtonVariant = "primary", size: ButtonSize = "md", extra = "") {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-[4px] border font-sans font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-100 no-underline";
  const sz = size === "sm" ? "min-h-9 px-3 py-1.5 text-[13px]" : "min-h-11 px-5 py-2.5 text-[15px]";
  const v = {
    primary:
      "border-accent bg-accent text-accent-ink hover:bg-[#9af7b2] hover:border-[#9af7b2] disabled:border-line disabled:bg-raised disabled:text-faint",
    ghost: "border-line-strong bg-transparent text-ink hover:border-accent hover:text-accent disabled:text-faint disabled:border-line",
    quiet: "border-transparent bg-transparent text-muted hover:text-ink hover:bg-raised",
  }[variant];
  return `${base} ${sz} ${v} ${extra}`.trim();
}

/** Input/select/textarea look. */
export const inputClass =
  "min-h-11 w-full rounded-[4px] border border-field bg-bg px-3 py-2.5 font-sans text-base text-ink placeholder:text-faint focus-visible:border-accent";

/** Mono uppercase field label. */
export const fieldLabelClass = "mb-1.5 block font-mono text-xs font-bold uppercase tracking-[0.08em] text-muted";

/* ---------- layout primitives ---------- */

/** Flat bordered panel. `raised` uses the lighter surface; `dock` adds the floating-over-map shadow. */
export function Panel({
  children,
  className = "",
  raised = false,
  dock = false,
  as: Tag = "div",
  ...rest
}: {
  children: React.ReactNode;
  className?: string;
  raised?: boolean;
  dock?: boolean;
  as?: "div" | "section" | "article" | "aside" | "li";
} & React.HTMLAttributes<HTMLElement>) {
  return (
    <Tag
      className={`rounded-panel border border-line ${raised ? "bg-raised" : "bg-panel"} p-4 sm:p-5 ${dock ? "shadow-dock" : ""} ${className}`}
      {...(rest as object)}
    >
      {children}
    </Tag>
  );
}

/** Mono uppercase micro-label, e.g. <SectionLabel>Election countdown</SectionLabel> renders "// ELECTION COUNTDOWN". */
export function SectionLabel({
  children,
  className = "",
  as: Tag = "p",
  id,
  tone = "muted",
}: {
  children: React.ReactNode;
  className?: string;
  as?: "p" | "h2" | "h3" | "h4" | "span" | "div";
  id?: string;
  tone?: "muted" | "accent";
}) {
  return (
    <Tag id={id} className={`font-mono text-xs font-bold uppercase tracking-[0.14em] ${tone === "accent" ? "text-accent" : "text-muted"} ${className}`}>
      <span aria-hidden="true" className="mr-1.5 opacity-70">
        {"//"}
      </span>
      {children}
    </Tag>
  );
}

/** Neutral mono chip for district codes, counts, tags. */
export function Chip({ children, className = "", accent = false }: { children: React.ReactNode; className?: string; accent?: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-chip border px-2 py-0.5 font-mono text-xs font-bold ${
        accent ? "border-accent/60 bg-accent-dim text-accent" : "border-line-strong bg-bg text-ink"
      } ${className}`}
    >
      {children}
    </span>
  );
}

/** Pulsing "live" dot, used while research is running. */
export function LiveDot({ className = "" }: { className?: string }) {
  return (
    <span aria-hidden="true" className={`relative inline-flex h-2.5 w-2.5 ${className}`}>
      <span className="bs-ping absolute inline-flex h-full w-full rounded-full bg-accent" />
      <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-accent" />
    </span>
  );
}

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

/** Amber (never red) error/warning panel. */
export function ErrorBox({ title = "Something went wrong", message, onRetry }: { title?: string; message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="rounded-panel border border-warn/60 bg-warn-dim p-4 text-ink">
      <p className="font-mono text-xs font-bold uppercase tracking-[0.12em] text-warn">
        <span aria-hidden="true">{"! "}</span>
        {title}
      </p>
      <p className="mt-1.5 text-sm text-muted">{message}</p>
      {onRetry && (
        <button onClick={onRetry} className={buttonClass("ghost", "sm", "mt-3")}>
          Try again
        </button>
      )}
    </div>
  );
}

export function EmptyState({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-lg rounded-panel border border-dashed border-line-strong bg-panel p-8 text-center">
      <SectionLabel className="mb-3">No data</SectionLabel>
      <p className="font-display text-2xl leading-tight tracking-[-0.02em] text-ink">{title}</p>
      <div className="mt-2 text-sm text-muted">{children}</div>
      <Link href="/" className={buttonClass("primary", "md", "mt-5")}>
        Find my ballot
      </Link>
    </div>
  );
}

/** Party is a neutral outlined mono label. Never colored by party. */
export function PartyBadge({ party }: { party?: string }) {
  if (!party) return null;
  return (
    <span className="inline-block whitespace-nowrap rounded-chip border border-line-strong px-1.5 py-px font-mono text-[11.5px] text-muted">{party}</span>
  );
}

/** Provenance seal: green check = official records, amber = AI-compiled. */
export function ProvenanceBadge({ provenance }: { provenance: BallotProvenance }) {
  const official = provenance === "official-seed";
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-chip border px-3 py-1.5 font-mono text-xs font-bold ${
        official ? "border-accent/60 bg-accent-dim text-accent" : "border-warn/60 bg-warn-dim text-warn"
      }`}
    >
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true" className="shrink-0">
        {official ? (
          <>
            <path d="M8 1l6 2.2v4.4c0 3.4-2.5 6-6 7.4-3.5-1.4-6-4-6-7.4V3.2L8 1z" stroke="currentColor" strokeWidth="1.4" />
            <path d="M5.2 8l2 2 3.6-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </>
        ) : (
          <>
            <path d="M8 1.8l6.5 11.4h-13L8 1.8z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
            <path d="M8 6.4v3M8 11.2v.1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </>
        )}
      </svg>
      {official ? "Verified from official election records" : "AI-compiled from cited sources: verify"}
    </span>
  );
}

/** Numbered citation chips. `indexes` are zero-based positions into `sources`. Mono, outlined, accent number. */
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
          className="inline-flex h-5 min-w-5 items-center justify-center rounded-chip border border-line-strong bg-bg px-1 font-mono text-[11px] font-bold text-accent no-underline hover:border-accent hover:bg-accent-dim"
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
    <div className="mt-4 border-t border-line pt-3">
      <SectionLabel as="h4">Sources</SectionLabel>
      <ol className="mt-2 space-y-1 text-sm">
        {sources.map((s, i) => (
          <li key={i} className="flex gap-2">
            <span className="w-6 shrink-0 text-right font-mono text-xs font-bold leading-5 text-accent">{i + 1}</span>
            <a href={s.url} target="_blank" rel="noopener noreferrer" className="break-words text-muted underline decoration-line-strong hover:text-accent hover:decoration-accent">
              {s.title}
            </a>
          </li>
        ))}
      </ol>
    </div>
  );
}
