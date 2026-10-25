// Label placement for the HTML-free SVG label layer. Everything here works in screen pixels so text stays a constant size.
import type { Bounds, View } from "./geometry";
import { STATE_GEOS, toScreen } from "./geometry";

export interface Box {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/** Rough text widths (px) for Space Grotesk (proportional) and Space Mono, good enough for fit tests. */
export const sansWidth = (s: string, size: number, spacing = 0) => s.length * (size * 0.56 + spacing);
export const monoWidth = (s: string, size: number, spacing = 0) => s.length * (size * 0.6 + spacing);

export class Placer {
  boxes: Box[] = [];
  constructor(private w: number, private h: number) {}
  fits(b: Box, pad = 2): boolean {
    if (b.x0 < 4 || b.y0 < 4 || b.x1 > this.w - 4 || b.y1 > this.h - 4) return false;
    return !this.boxes.some((o) => b.x0 < o.x1 + pad && b.x1 > o.x0 - pad && b.y0 < o.y1 + pad && b.y1 > o.y0 - pad);
  }
  /** Like fits(), but ignores one reserved box (used for the label that belongs to the pin). */
  fitsIgnoring(b: Box, skip: Box | null, pad = 2): boolean {
    if (b.x0 < 4 || b.y0 < 4 || b.x1 > this.w - 4 || b.y1 > this.h - 4) return false;
    return !this.boxes.some((o) => o !== skip && b.x0 < o.x1 + pad && b.x1 > o.x0 - pad && b.y0 < o.y1 + pad && b.y1 > o.y0 - pad);
  }
  add(b: Box) {
    this.boxes.push(b);
  }
}

export interface StateLabel {
  abbr: string;
  text: string;
  x: number;
  y: number;
  size: number;
  mono: boolean;
  anchor: "middle" | "start";
  leader?: [number, number, number, number];
}

/** Small northeastern states that get a leader line into the Atlantic when even the postal code will not fit inside. */
const LEADER = new Set(["VT", "NH", "MA", "RI", "CT", "NJ", "DE", "MD", "DC"]);

const sizeOf = (b: Bounds, k: number) => ({ w: (b[1][0] - b[0][0]) * k, h: (b[1][1] - b[0][1]) * k });

/** National stage: postal codes everywhere (for consistency), leader lines for the tiny Northeast states. */
export function nationLabels(view: View, w: number, h: number, project: (lng: number, lat: number) => [number, number] | null): StateLabel[] {
  const out: StateLabel[] = [];
  const codeSize = Math.max(9.5, Math.min(12, view.k * 8.8));
  const pending: { abbr: string; ax: number; ay: number; text: string }[] = [];
  for (const s of STATE_GEOS) {
    const [x, y] = toScreen(view, s.anchor);
    const { w: bw, h: bh } = sizeOf(s.bounds, view.k);
    const codeW = monoWidth(s.abbr, codeSize, 0.5);
    if (s.abbr === "DC") {
      pending.push({ abbr: s.abbr, ax: x, ay: y, text: s.abbr });
      continue;
    }
    if (codeW <= bw * 0.78 && codeSize * 1.2 <= bh) out.push({ abbr: s.abbr, text: s.abbr, x, y, size: codeSize, mono: true, anchor: "middle" });
    else if (LEADER.has(s.abbr)) pending.push({ abbr: s.abbr, ax: x, ay: y, text: s.abbr });
  }
  // Leader labels stack in a column in the Atlantic, ordered north to south so the lines never cross.
  const col = project(-68.6, 40);
  if (col && pending.length) {
    const colX = Math.min(toScreen(view, col)[0], w - 26);
    const lineH = codeSize + 5;
    pending.sort((a, b) => a.ay - b.ay);
    let prev = -Infinity;
    for (const p of pending) {
      const y = Math.max(p.ay, prev + lineH);
      prev = y;
      out.push({ abbr: p.abbr, text: p.text, x: colX + 7, y, size: codeSize, mono: true, anchor: "start", leader: [p.ax, p.ay, colX + 3, y - codeSize * 0.32] });
    }
  }
  void h;
  return out;
}
