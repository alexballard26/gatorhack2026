import { Fragment, type ReactNode } from "react";
import type { Source } from "@/lib/types";
import { Cites } from "./ui";

// Minimal, safe markdown: headings, paragraphs, lists, bold/italic/code, http(s) links,
// and numeric citation markers like [1] or [1, 2] rendered as source chips.
const INLINE = /(\*\*[^*]+\*\*|\*[^*\n]+\*|`[^`\n]+`|\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)|\[(\d+(?:\s*,\s*\d+)*)\])/g;

function inline(text: string, sources: Source[], key: string): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  let n = 0;
  for (const m of text.matchAll(INLINE)) {
    const idx = m.index ?? 0;
    if (idx > last) out.push(text.slice(last, idx));
    const tok = m[0];
    const k = `${key}-${n++}`;
    if (tok.startsWith("**")) out.push(<strong key={k}>{inline(tok.slice(2, -2), sources, k)}</strong>);
    else if (tok.startsWith("`")) out.push(<code key={k} className="rounded bg-slate-100 px-1 text-[0.9em]">{tok.slice(1, -1)}</code>);
    else if (m[3]) out.push(<a key={k} href={m[3]} target="_blank" rel="noopener noreferrer" className="text-teal-800 underline underline-offset-2">{m[2]}</a>);
    else if (m[4]) {
      const idxs = m[4].split(",").map((s) => Number(s.trim()) - 1);
      out.push(sources.length ? <Cites key={k} indexes={idxs} sources={sources} /> : tok);
    } else if (tok.startsWith("*")) out.push(<em key={k}>{tok.slice(1, -1)}</em>);
    last = idx + tok.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function Markdown({ text, sources = [] }: { text: string; sources?: Source[] }) {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const blocks: ReactNode[] = [];
  let para: string[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;
  let b = 0;

  const flushPara = () => {
    if (para.length) {
      const k = `p${b++}`;
      blocks.push(<p key={k} className="leading-relaxed">{inline(para.join(" "), sources, k)}</p>);
      para = [];
    }
  };
  const flushList = () => {
    if (list) {
      const k = `l${b++}`;
      const items = list.items.map((it, i) => <li key={i}>{inline(it, sources, `${k}-${i}`)}</li>);
      blocks.push(
        list.ordered ? (
          <ol key={k} className="list-decimal space-y-1 pl-6">{items}</ol>
        ) : (
          <ul key={k} className="list-disc space-y-1 pl-6">{items}</ul>
        ),
      );
      list = null;
    }
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    const h = /^(#{1,4})\s+(.*)$/.exec(line);
    const ul = /^\s*[-*]\s+(.*)$/.exec(line);
    const ol = /^\s*\d+[.)]\s+(.*)$/.exec(line);
    if (!line.trim()) {
      flushPara();
      flushList();
    } else if (h) {
      flushPara();
      flushList();
      const k = `h${b++}`;
      const level = h[1].length;
      const cls = level === 1 ? "text-xl font-semibold text-slate-900" : level === 2 ? "mt-2 text-lg font-semibold text-slate-900" : "mt-1 font-semibold text-slate-900";
      blocks.push(<h3 key={k} className={cls}>{inline(h[2], sources, k)}</h3>);
    } else if (/^---+$/.test(line.trim())) {
      flushPara();
      flushList();
      blocks.push(<hr key={`r${b++}`} className="border-slate-200" />);
    } else if (ul || ol) {
      flushPara();
      const ordered = Boolean(ol);
      if (list && list.ordered !== ordered) flushList();
      if (!list) list = { ordered, items: [] };
      list.items.push((ul ?? ol)![1]);
    } else {
      flushList();
      para.push(line.trim());
    }
  }
  flushPara();
  flushList();
  return (
    <div className="space-y-3 text-slate-800">
      {blocks.map((bl, i) => (
        <Fragment key={i}>{bl}</Fragment>
      ))}
    </div>
  );
}
