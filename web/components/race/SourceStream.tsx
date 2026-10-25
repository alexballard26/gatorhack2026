"use client";
import type { Source } from "@/lib/types";
import { SectionLabel } from "../ui";
import { domainOf, pad2 } from "./util";

/** Mono list of source domains with index numbers, like the mission-control "source stream". */
export function SourceStream({ sources, maxHeight = "max-h-40", label = "Source stream" }: { sources: Source[]; maxHeight?: string; label?: string }) {
  if (!sources.length) return null;
  return (
    <div>
      <SectionLabel as="h4" className="mb-2">
        {label}
      </SectionLabel>
      <ol className={`${maxHeight} overflow-auto font-mono text-[12.5px] leading-[1.9]`} aria-label="Sources read" tabIndex={0}>
        {sources.map((s, i) => (
          <li key={i} className="flex gap-3 border-b border-line/70 last:border-0">
            <span className="w-7 shrink-0 text-faint" aria-hidden="true">
              {pad2(i + 1)}
            </span>
            <a href={s.url} target="_blank" rel="noopener noreferrer" title={s.title} className="min-w-0 truncate text-ink no-underline hover:text-accent hover:underline">
              <span className="sr-only">Source {i + 1}: </span>
              {domainOf(s)}
            </a>
          </li>
        ))}
      </ol>
    </div>
  );
}
