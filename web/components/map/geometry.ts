// Shared cartography for the election map: one Albers-USA projection (AK/HI insets), states from us-atlas
// (Census cartographic boundaries: already shoreline-clipped, no Great Lakes), pre-built SVG path strings.
import { geoAlbers, geoAlbersUsa, geoGraticule, geoPath } from "d3-geo";
import { feature, mesh } from "topojson-client";
import type { GeometryCollection, GeometryObject, Topology } from "topojson-specification";
import statesJson from "us-atlas/states-10m.json";
import { STATE_BY_FIPS } from "@/lib/geo/states";

/** World coordinate frame: the projection is fitted to this box; the viewport transform maps world to pixels. */
export const WORLD_W = 975;
export const WORLD_H = 610;

const topo = statesJson as unknown as Topology;
const nationFeature = feature(topo, topo.objects.nation as GeometryObject) as unknown as GeoJSON.Feature;

export const projection = geoAlbersUsa().fitSize([WORLD_W, WORLD_H], nationFeature as never);
export const path = geoPath(projection);

export type Bounds = [[number, number], [number, number]];

export interface StateGeo {
  abbr: string;
  name: string;
  fips: string;
  feature: GeoJSON.Feature;
  d: string;
  bounds: Bounds;
  /** Label anchor in world coordinates. */
  anchor: [number, number];
}

const fc = feature(topo, topo.objects.states as GeometryCollection) as unknown as GeoJSON.FeatureCollection;

export const STATE_GEOS: StateGeo[] = fc.features
  .map((f) => {
    const info = STATE_BY_FIPS[String(f.id).padStart(2, "0")];
    if (!info) return null;
    const d = path(f as never);
    if (!d) return null;
    const anchor = projection(info.label) ?? (path.centroid(f as never) as [number, number]);
    return { abbr: info.abbr, name: info.name, fips: info.fips, feature: f, d, bounds: path.bounds(f as never) as Bounds, anchor } as StateGeo;
  })
  .filter((s): s is StateGeo => s !== null);

export const STATE_GEO: Record<string, StateGeo> = Object.fromEntries(STATE_GEOS.map((s) => [s.abbr, s]));

export const NATION_D = path(nationFeature as never) ?? "";
export const NATION_BOUNDS = path.bounds(nationFeature as never) as Bounds;
export const STATE_MESH_D = path(mesh(topo, topo.objects.states as GeometryCollection, (a, b) => a !== b) as never) ?? "";

// Graticule in the lower-48 Albers frame (same parameters d3 uses inside geoAlbersUsa), drawn only over the CONUS ocean.
const lower48 = geoAlbers().rotate([96, 0]).center([-0.6, 38.7]).parallels([29.5, 45.5]).scale(projection.scale()).translate(projection.translate());
export const GRATICULE_D =
  geoPath(lower48)(geoGraticule().extent([[-140, 15], [-50, 60]]).step([5, 5])()) ?? "";

/** Screen-space helpers shared by the map and its label layout. */
export interface View {
  k: number;
  tx: number;
  ty: number;
}

export interface Pad {
  t: number;
  r: number;
  b: number;
  l: number;
}

export function fitView(b: Bounds, w: number, h: number, pad: Pad, maxK = 1e6): View {
  const bw = Math.max(b[1][0] - b[0][0], 1e-6);
  const bh = Math.max(b[1][1] - b[0][1], 1e-6);
  const aw = Math.max(w - pad.l - pad.r, 40);
  const ah = Math.max(h - pad.t - pad.b, 40);
  const k = Math.min(aw / bw, ah / bh, maxK);
  const cx = (b[0][0] + b[1][0]) / 2;
  const cy = (b[0][1] + b[1][1]) / 2;
  return { k, tx: pad.l + aw / 2 - cx * k, ty: pad.t + ah / 2 - cy * k };
}

export function toScreen(v: View, p: [number, number]): [number, number] {
  return [v.tx + v.k * p[0], v.ty + v.k * p[1]];
}

/**
 * TIGERweb GeoJSON uses the planar (RFC 7946) winding, but d3-geo is spherical and treats that winding as "everything
 * except this polygon". Re-wind rings so exteriors are clockwise and holes counter-clockwise (in lon/lat).
 */
export function rewindFeature(f: GeoJSON.Feature): GeoJSON.Feature {
  const area = (ring: number[][]) => {
    let s = 0;
    for (let i = 0, n = ring.length - 1; i < n; i++) s += ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1];
    return s / 2;
  };
  const fix = (poly: number[][][]) => poly.map((ring, i) => ((i === 0 ? area(ring) > 0 : area(ring) < 0) ? [...ring].reverse() : ring));
  const g = f.geometry;
  if (g.type === "Polygon") return { ...f, geometry: { ...g, coordinates: fix(g.coordinates) } };
  if (g.type === "MultiPolygon") return { ...f, geometry: { ...g, coordinates: g.coordinates.map(fix) } };
  return f;
}
