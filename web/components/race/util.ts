import type { Source } from "@/lib/types";

/** Display domain for a source: prefer a domain-like title, else the URL hostname. */
export function domainOf(s: Source): string {
  const t = (s.title ?? "").trim();
  if (/^[a-z0-9.-]+\.[a-z]{2,}(\/\S*)?$/i.test(t)) return t.replace(/^www\./i, "");
  try {
    return new URL(s.url).hostname.replace(/^www\./i, "");
  } catch {
    return t || "source";
  }
}

export const pad2 = (n: number) => String(n).padStart(2, "0");

export const fmtClock = (s: number) => `${Math.floor(s / 60)}:${pad2(s % 60)}`;
