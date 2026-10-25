import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

// TIGERweb Census 2020 WMS service, layer 26 = Incorporated Places (POP100, CENTLAT, CENTLON).
const URL_BASE = "https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/tigerWMS_Census2020/MapServer/26/query";
const cache = new Map<string, { at: number; body: string }>();
const TTL_MS = 24 * 60 * 60 * 1000;

/** GET /api/places?bbox=minLng,minLat,maxLng,maxLat : the ~25 most populous incorporated places in the box. */
export async function GET(req: NextRequest) {
  const parts = (req.nextUrl.searchParams.get("bbox") ?? "").split(",").map(Number);
  if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n))) return NextResponse.json({ error: "bbox=minLng,minLat,maxLng,maxLat required" }, { status: 400 });
  const [w, s, e, n] = parts;
  if (w >= e || s >= n || w < -180 || e > 180 || s < -90 || n > 90) return NextResponse.json({ error: "Invalid bbox" }, { status: 400 });

  const key = [w, s, e, n].map((v) => v.toFixed(2)).join(",");
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return new NextResponse(hit.body, { headers: { "Content-Type": "application/json", "Cache-Control": "public, max-age=86400" } });

  const qs = new URLSearchParams({
    geometry: `${w},${s},${e},${n}`,
    geometryType: "esriGeometryEnvelope",
    inSR: "4326",
    spatialRel: "esriSpatialRelIntersects",
    outFields: "BASENAME,POP100,CENTLAT,CENTLON",
    returnGeometry: "false",
    orderByFields: "POP100 DESC",
    resultRecordCount: "25",
    f: "json",
  });
  try {
    const res = await fetch(`${URL_BASE}?${qs}`, { signal: AbortSignal.timeout(15000), headers: { Accept: "application/json" } });
    if (!res.ok) return NextResponse.json({ error: `Census service returned ${res.status}` }, { status: 502 });
    const json = (await res.json()) as { features?: { attributes: Record<string, string | number> }[] };
    if (!Array.isArray(json.features)) return NextResponse.json({ error: "Census service returned invalid data" }, { status: 502 });
    const places = json.features
      .map((f) => ({ name: String(f.attributes.BASENAME), pop: Number(f.attributes.POP100), lat: parseFloat(String(f.attributes.CENTLAT)), lng: parseFloat(String(f.attributes.CENTLON)) }))
      .filter((p) => p.name && Number.isFinite(p.lat) && Number.isFinite(p.lng));
    const body = JSON.stringify({ places });
    cache.set(key, { at: Date.now(), body });
    return new NextResponse(body, { headers: { "Content-Type": "application/json", "Cache-Control": "public, max-age=86400" } });
  } catch {
    return NextResponse.json({ error: "Census service timed out or is unreachable" }, { status: 502 });
  }
}
