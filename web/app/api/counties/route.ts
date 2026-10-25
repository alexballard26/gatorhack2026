import { NextRequest, NextResponse } from "next/server";
import { feature } from "topojson-client";
import type { GeometryCollection, Topology } from "topojson-specification";
import { readFileSync } from "fs";
import path from "path";
import { STATE_BY_ABBR, STATE_BY_FIPS } from "@/lib/geo/states";

export const runtime = "nodejs";

let topoCache: Topology | undefined;
/** Read lazily (842 KB) from the us-atlas package; never shipped to the client. */
function loadTopo(): Topology {
  topoCache ??= JSON.parse(readFileSync(path.join(process.cwd(), "node_modules", "us-atlas", "counties-10m.json"), "utf8")) as Topology;
  return topoCache;
}
const cache = new Map<string, string>();

const round = (c: unknown): unknown => (Array.isArray(c) ? (typeof c[0] === "number" ? c.map((n: number) => Math.round(n * 1e4) / 1e4) : c.map(round)) : c);

/**
 * GET /api/counties?state=FL (postal code or FIPS): that state's counties as GeoJSON, cut from the Census cartographic
 * boundary file in us-atlas (shoreline-clipped). Properties: { id: 5-digit FIPS, name }.
 */
export async function GET(req: NextRequest) {
  const raw = (req.nextUrl.searchParams.get("state") ?? "").trim().toUpperCase();
  const st = STATE_BY_ABBR[raw] ?? STATE_BY_FIPS[raw.padStart(2, "0")];
  if (!st) return NextResponse.json({ error: "Unknown state" }, { status: 400 });

  let body = cache.get(st.fips);
  if (!body) {
    const topo = loadTopo();
    const all = topo.objects.counties as GeometryCollection;
    const sub: GeometryCollection = { type: "GeometryCollection", geometries: all.geometries.filter((g) => String(g.id).startsWith(st.fips)) };
    const fc = feature(topo, sub) as unknown as GeoJSON.FeatureCollection;
    for (const f of fc.features) {
      f.properties = { id: String(f.id), name: (f.properties as { name?: string } | null)?.name ?? "" };
      delete f.id;
      (f.geometry as { coordinates: unknown }).coordinates = round((f.geometry as { coordinates: unknown }).coordinates);
    }
    body = JSON.stringify(fc);
    cache.set(st.fips, body);
  }
  return new NextResponse(body, { headers: { "Content-Type": "application/json", "Cache-Control": "public, max-age=86400, s-maxage=86400" } });
}
