/* eslint-disable @typescript-eslint/no-explicit-any -- untyped Census/TIGERweb JSON */
import type { DistrictBoundaries, DistrictsResponse, VoterLocation } from "../types";

const GEOCODER = "https://geocoding.geo.census.gov/geocoder/geographies";
const TIGER = "https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb";
const TIMEOUT_MS = 15000;

// TIGERweb layer IDs (verified 2026-10): Legislative MapServer 0 = 120th Congressional,
// 1 = 2026 SLD Upper, 2 = 2026 SLD Lower; State_County MapServer 1 = Counties (current).
const LAYERS = {
  congressional: { url: `${TIGER}/Legislative/MapServer/0/query`, vintage: "120th Congressional Districts" },
  stateSenate: { url: `${TIGER}/Legislative/MapServer/1/query`, vintage: "2026 State Legislative Districts" },
  stateHouse: { url: `${TIGER}/Legislative/MapServer/2/query`, vintage: "2026 State Legislative Districts" },
  previousCongressional: { url: `${TIGER}/Legislative/MapServer/4/query`, vintage: "119th Congressional Districts" },
  county: { url: `${TIGER}/State_County/MapServer/1/query`, vintage: "Current counties" },
} as const;

export class GeoError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function fetchJson(url: string): Promise<any> {
  let res: Response;
  try {
    res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS), headers: { Accept: "application/json" } });
  } catch {
    throw new GeoError(502, "Census service timed out or is unreachable");
  }
  if (!res.ok) throw new GeoError(502, `Census service returned ${res.status}`);
  try {
    return await res.json();
  } catch {
    throw new GeoError(502, "Census service returned invalid JSON");
  }
}

/** Find the geography array whose layer name matches. */
function pick(geos: Record<string, any[]>, re: RegExp): any | undefined {
  for (const [name, arr] of Object.entries(geos)) if (re.test(name) && arr?.length) return arr[0];
  return undefined;
}

function stripLeadingZeros(s?: string): string | undefined {
  if (s == null || s === "") return undefined;
  if (/^\d+$/.test(s)) return String(parseInt(s, 10));
  return s;
}

function parseGeographies(geos: Record<string, any[]>, base: Partial<VoterLocation>) {
  const state = pick(geos, /^States$/);
  if (!state) throw new GeoError(404, "Location is not in a US state");
  const county = pick(geos, /^Counties$/);
  const cd = pick(geos, /Congressional Districts/);
  const su = pick(geos, /State Legislative Districts - Upper/);
  const sl = pick(geos, /State Legislative Districts - Lower/);
  const place = pick(geos, /^Incorporated Places$/);

  // BASENAME is e.g. "3"; at-large districts come back as "00"/"98" with NAME containing "at Large".
  const cdName: string | undefined = cd?.NAME;
  const cdVal = cd
    ? /at large/i.test(cdName ?? "") || /^(00|98)$/.test(cd.BASENAME ?? "") ? "AL" : stripLeadingZeros(cd.BASENAME)
    : undefined;

  const location: VoterLocation = {
    ...base,
    state: state.STUSAB,
    county: county?.BASENAME,
    congressionalDistrict: cdVal,
    stateSenateDistrict: stripLeadingZeros(su?.BASENAME),
    stateHouseDistrict: stripLeadingZeros(sl?.BASENAME),
    place: place?.BASENAME,
    method: base.method ?? "address",
  } as VoterLocation;

  return {
    location,
    geoids: {
      congressional: cd?.GEOID as string | undefined,
      stateSenate: su?.GEOID as string | undefined,
      stateHouse: sl?.GEOID as string | undefined,
      county: county?.GEOID as string | undefined,
    },
  };
}

const geoCommon = "benchmark=Public_AR_Current&vintage=Current_Current&format=json";

/** Fallback geocoder (OpenStreetMap Nominatim, free, no key) for addresses the Census range-based geocoder lacks (e.g. campus roads). */
async function nominatim(address: string): Promise<{ lat: number; lng: number; display: string } | undefined> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=jsonv2&countrycodes=us&limit=1&q=${encodeURIComponent(address)}`,
      { signal: AbortSignal.timeout(TIMEOUT_MS), headers: { "User-Agent": "BallotScout-hackathon/1.0", Accept: "application/json" } },
    );
    if (!res.ok) return undefined;
    const arr = await res.json();
    const r = arr?.[0];
    if (!r) return undefined;
    return { lat: Number(r.lat), lng: Number(r.lon), display: r.display_name };
  } catch {
    return undefined;
  }
}

export async function lookupAddress(address: string) {
  const data = await fetchJson(`${GEOCODER}/onelineaddress?address=${encodeURIComponent(address)}&${geoCommon}`);
  const match = data?.result?.addressMatches?.[0];
  if (!match) {
    const fb = await nominatim(address);
    if (!fb) throw new GeoError(404, "Address not found");
    const r = await lookupPoint(fb.lat, fb.lng);
    r.location.address = fb.display;
    r.location.method = "address";
    return r;
  }
  return parseGeographies(match.geographies ?? {}, {
    address: match.matchedAddress,
    lat: match.coordinates?.y,
    lng: match.coordinates?.x,
    method: "address",
  });
}

export async function lookupPoint(lat: number, lng: number) {
  const data = await fetchJson(`${GEOCODER}/coordinates?x=${lng}&y=${lat}&${geoCommon}`);
  const geos = data?.result?.geographies;
  if (!geos || !Object.keys(geos).length) throw new GeoError(404, "No US geography found at that point");
  return parseGeographies(geos, { lat, lng, method: "map-click" });
}

// ---- boundaries (in-memory cache keyed by layer + GEOID) ----
const boundaryCache = new Map<string, GeoJSON.Feature>();
const inflight = new Map<string, Promise<GeoJSON.Feature | undefined>>();

async function fetchBoundary(kind: keyof typeof LAYERS, geoid: string): Promise<GeoJSON.Feature | undefined> {
  const key = `${kind}:${geoid}`;
  const hit = boundaryCache.get(key);
  if (hit) return hit;
  const pending = inflight.get(key);
  if (pending) return pending;
  const p = (async () => {
    const params = new URLSearchParams({
      where: `GEOID='${geoid.replace(/[^0-9A-Za-z]/g, "")}'`,
      outFields: "GEOID,NAME,BASENAME",
      outSR: "4326",
      f: "geojson",
      maxAllowableOffset: kind === "county" ? "0.003" : "0.001",
      geometryPrecision: "5",
    });
    try {
      const fc = await fetchJson(`${LAYERS[kind].url}?${params}`);
      const f = fc?.features?.[0] as GeoJSON.Feature | undefined;
      if (f) {
        f.properties = { ...f.properties, layer: kind, vintage: LAYERS[kind].vintage };
        boundaryCache.set(key, f);
      }
      return f;
    } catch {
      return undefined; // boundaries are best-effort; location data is still useful
    } finally {
      inflight.delete(key);
    }
  })();
  inflight.set(key, p);
  return p;
}

export async function getBoundaries(geoids: Record<keyof DistrictBoundaries, string | undefined>): Promise<DistrictBoundaries> {
  const keys = Object.keys(LAYERS) as (keyof typeof LAYERS)[];
  const results = await Promise.all(keys.map((k) => (geoids[k] ? fetchBoundary(k, geoids[k]!) : undefined)));
  const out: DistrictBoundaries = {};
  keys.forEach((k, i) => {
    if (results[i]) out[k] = results[i];
  });
  return out;
}

/** Previous (119th Congress) congressional district at a point. Best-effort: undefined on failure. */
async function lookupPreviousCongressional(lat: number, lng: number): Promise<{ district: string; geoid: string } | undefined> {
  try {
    const params = new URLSearchParams({
      geometry: `${lng},${lat}`,
      geometryType: "esriGeometryPoint",
      inSR: "4326",
      spatialRel: "esriSpatialRelIntersects",
      outFields: "GEOID,NAME,BASENAME",
      returnGeometry: "false",
      f: "json",
    });
    const data = await fetchJson(`${LAYERS.previousCongressional.url}?${params}`);
    const a = data?.features?.[0]?.attributes;
    if (!a?.GEOID) return undefined;
    const district = /at large/i.test(a.NAME ?? "") || /^(00|98)$/.test(a.BASENAME ?? "") ? "AL" : stripLeadingZeros(a.BASENAME);
    return district ? { district, geoid: a.GEOID } : undefined;
  } catch {
    return undefined;
  }
}

export async function resolveDistricts(
  input: { address: string } | { lat: number; lng: number },
): Promise<DistrictsResponse & { boundaryVintage: string }> {
  const { location, geoids } = "address" in input ? await lookupAddress(input.address) : await lookupPoint(input.lat, input.lng);
  const prev = location.lat != null && location.lng != null ? await lookupPreviousCongressional(location.lat, location.lng) : undefined;
  if (prev) location.previousCongressionalDistrict = prev.district;
  const boundaries = await getBoundaries({ ...geoids, previousCongressional: prev?.geoid });
  return {
    location,
    boundaries,
    boundaryVintage: "120th Congressional Districts (previous: 119th); 2026 State Legislative Districts",
  };
}
