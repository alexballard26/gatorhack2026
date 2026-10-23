import { Fragment, type ReactNode } from "react";
import type { Source } from "@/lib/types";
import { Cites } from "./ui";

export const slugify = (t: string) => t.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const plain = (t: string) => t.replace(/\*+|`/g, "").replace(/\[\d+(?:\s*,\s*\d+)*\]/g, "").trim();

/** Level-2 headings of a markdown string, for a table of contents. */
export function headingsOf(text: string): { id: string; title: string }[] {
  const seen = new Map<string, number>();
  const out: { id: string; title: string }[] = [];
  for (const l of text.replace(/\r\n/g, "\n").split("\n")) {
    const m = /^##\s+(.*)$/.exec(l.trim());
    if (!m) continue;
    const title = plain(m[1]);
    const base = slugify(title) || "section";
    const n = seen.get(base) ?? 0;
    seen.set(base, n + 1);
    out.push({ id: n ? `${base}-${n}` : base, title });
  }
  return out;
}

type Item = { ordered: boolean; text: string; children: Item[] };

const splitRow = (line: string) => {
  let t = line.trim();
  if (t.startsWith("|")) t = t.slice(1);
  if (t.endsWith("|") && !t.endsWith("\\|")) t = t.slice(0, -1);
  return t.split(/(?<!\\)\|/).map((c) => c.trim().replace(/\\\|/g, "|"));
};
const isSep = (line: string) => /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(line) && line.includes("-");

// Minimal, safe markdown: headings, paragraphs, lists, bold/italic/code, http(s) links,
// and numeric citation markers like [1] or [1, 2] rendered as source chips.
const INLINE = /(\*\*\*[^*\n]+\*\*\*|\*\*[^*]+\*\*|\*[^*\n]+\*|`[^`\n]+`|\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)|\[(\d+(?:\s*,\s*\d+)*)\])/g;

export function inline(text: string, sources: Source[], key: string): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  let n = 0;
  for (const m of text.matchAll(INLINE)) {
    const idx = m.index ?? 0;
    if (idx > last) out.push(text.slice(last, idx));
    const tok = m[0];
    const k = `${key}-${n++}`;
    if (tok.startsWith("***")) out.push(<strong key={k}><em>{inline(tok.slice(3, -3), sources, k)}</em></strong>);
    else if (tok.startsWith("**")) out.push(<strong key={k}>{inline(tok.slice(2, -2), sources, k)}</strong>);
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
  let list: { ind: number; item: Item }[] | null = null; // flat list lines with indent
  let b = 0;
  const heads = headingsOf(text);
  let h2 = 0;

  const flushPara = () => {
    if (para.length) {
      const k = `p${b++}`;
      blocks.push(<p key={k} className="leading-relaxed">{inline(para.join(" "), sources, k)}</p>);
      para = [];
    }
  };
  const renderItems = (items: Item[], k: string, depth: number): ReactNode => {
    if (!items.length) return null;
    const ordered = items[0].ordered;
    const cls = `${ordered ? "list-decimal" : depth ? "list-[circle]" : "list-disc"} space-y-1 pl-6 ${depth ? "mt-1" : ""}`;
    const lis = items.map((it, i) => (
      <li key={i} className="leading-relaxed">
        {inline(it.text, sources, `${k}-${i}`)}
        {renderItems(it.children, `${k}-${i}`, depth + 1)}
      </li>
    ));
    return ordered ? <ol className={cls}>{lis}</ol> : <ul className={cls}>{lis}</ul>;
  };
  const flushList = () => {
    if (!list) return;
    const k = `l${b++}`;
    const roots: Item[] = [];
    const stack: { ind: number; item: Item }[] = [];
    for (const e of list) {
      while (stack.length && stack[stack.length - 1].ind >= e.ind) stack.pop();
      if (stack.length) stack[stack.length - 1].item.children.push(e.item);
      else roots.push(e.item);
      stack.push(e);
    }
    blocks.push(<Fragment key={k}>{renderItems(roots, k, 0)}</Fragment>);
    list = null;
  };
  const flushAll = () => {
    flushPara();
    flushList();
  };

  const table = (rows: string[], k: string) => {
    const head = splitRow(rows[0]);
    const body = rows.slice(2).map(splitRow);
    blocks.push(
      <div key={k} className="-mx-1 overflow-x-auto rounded-lg border border-slate-200" tabIndex={0} role="region" aria-label="Comparison table (scrolls horizontally)">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-teal-50">
              {head.map((c, i) => (
                <th key={i} scope="col" className={`border-b border-teal-200 px-3 py-2 text-left align-bottom font-semibold text-slate-900 ${i === 0 ? "sticky left-0 z-10 bg-teal-50" : "min-w-[15rem] max-w-[26rem]"}`}>
                  {inline(c, sources, `${k}h${i}`)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {body.map((r, ri) => (
              <tr key={ri} className={ri % 2 ? "bg-slate-50" : "bg-white"}>
                {head.map((_, ci) => {
                  const cls = `border-b border-slate-100 px-3 py-2 align-top leading-relaxed ${ci === 0 ? `sticky left-0 z-10 max-w-[12rem] font-medium text-slate-900 ${ri % 2 ? "bg-slate-50" : "bg-white"}` : "min-w-[15rem] max-w-[26rem]"}`;
                  const content = inline(r[ci] ?? "", sources, `${k}r${ri}c${ci}`);
                  return ci === 0 ? <th key={ci} scope="row" className={`${cls} text-left`}>{content}</th> : <td key={ci} className={cls}>{content}</td>;
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>,
    );
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trimEnd();
    const t = line.trim();
    const h = /^(#{1,4})\s+(.*)$/.exec(t);
    const ul = /^(\s*)[-*+]\s+(.*)$/.exec(line);
    const ol = /^(\s*)\d+[.)]\s+(.*)$/.exec(line);
    if (!t) {
      flushAll();
    } else if (t.startsWith("|") && i + 1 < lines.length && isSep(lines[i + 1]) && lines[i + 1].includes("|")) {
      flushAll();
      const rows = [line, lines[i + 1]];
      i += 2;
      while (i < lines.length && lines[i].trim().startsWith("|")) rows.push(lines[i++]);
      i--;
      table(rows, `t${b++}`);
    } else if (h) {
      flushAll();
      const k = `h${b++}`;
      const level = h[1].length;
      const cls = level === 1 ? "text-xl font-semibold text-slate-900" : level === 2 ? "mt-4 scroll-mt-4 border-b border-slate-200 pb-1 text-lg font-semibold text-slate-900" : "mt-2 font-semibold text-slate-900";
      const id = level === 2 ? heads[h2++]?.id : undefined;
      blocks.push(<h3 key={k} id={id} className={cls}>{inline(h[2], sources, k)}</h3>);
    } else if (/^([-*_])(\s*\1){2,}$/.test(t)) {
      flushAll();
      blocks.push(<hr key={`r${b++}`} className="my-2 border-slate-200" />);
    } else if (ul || ol) {
      flushPara();
      const m = (ul ?? ol)!;
      const ordered = Boolean(ol) && !ul;
      if (!list) list = [];
      list.push({ ind: m[1].replace(/\t/g, "    ").length, item: { ordered, text: m[2], children: [] } });
    } else if (list && /^\s+\S/.test(line)) {
      list[list.length - 1].item.text += " " + t; // continuation line
    } else {
      flushList();
      para.push(t);
    }
  }
  flushAll();
  return (
    <div className="space-y-3 text-slate-800">
      {blocks.map((bl, i) => (
        <Fragment key={i}>{bl}</Fragment>
      ))}
    </div>
  );
}
