import { NextRequest, NextResponse } from "next/server";
import { STATE_BY_ABBR, STATE_BY_FIPS } from "@/lib/geo/states";

export const runtime = "nodejs";

const URL_BASE = "https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/State_County/MapServer/1/query";
const cache = new Map<string, { at: number; body: GeoJSON.FeatureCollection }>();
const TTL_MS = 24 * 60 * 60 * 1000;

/** GET /api/counties?state=FL (postal code or FIPS): simplified county polygons for one state, cached in memory. */
export async function GET(req: NextRequest) {
  const raw = (req.nextUrl.searchParams.get("state") ?? "").trim().toUpperCase();
  const st = STATE_BY_ABBR[raw] ?? STATE_BY_FIPS[raw.padStart(2, "0")];
  if (!st) return NextResponse.json({ error: "Unknown state" }, { status: 400 });

  const hit = cache.get(st.fips);
  if (hit && Date.now() - hit.at < TTL_MS) return NextResponse.json(hit.body, { headers: { "Cache-Control": "public, max-age=86400" } });

  const qs = new URLSearchParams({
    where: `STATE='${st.fips}'`,
    outFields: "BASENAME,NAME,GEOID,INTPTLAT,INTPTLON",
    outSR: "4326",
    maxAllowableOffset: "0.005",
    geometryPrecision: "5",
    f: "geojson",
  });
  try {
    const res = await fetch(`${URL_BASE}?${qs}`, { signal: AbortSignal.timeout(20000), headers: { Accept: "application/json" } });
    if (!res.ok) return NextResponse.json({ error: `Census service returned ${res.status}` }, { status: 502 });
    const json = (await res.json()) as GeoJSON.FeatureCollection;
    if (!Array.isArray(json?.features)) return NextResponse.json({ error: "Census service returned invalid data" }, { status: 502 });
    cache.set(st.fips, { at: Date.now(), body: json });
    return NextResponse.json(json, { headers: { "Cache-Control": "public, max-age=86400" } });
  } catch {
    return NextResponse.json({ error: "Census service timed out or is unreachable" }, { status: 502 });
  }
}
