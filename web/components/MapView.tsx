"use client";
import { useEffect, useRef, useState } from "react";
import maplibregl, { type ExpressionSpecification, type GeoJSONSource, type Map as MLMap } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { DistrictBoundaries } from "@/lib/types";

type LayerKey = keyof DistrictBoundaries;

const LAYERS: { key: LayerKey; label: string; color: string; dash?: number[]; width: number; glow?: boolean }[] = [
  { key: "previousCongressional", label: "Old congressional district (2024)", color: "#8a9a92", dash: [2, 2], width: 1.5 },
  { key: "county", label: "County", color: "#a5b7ae", dash: [3, 2], width: 1.6 },
  { key: "congressional", label: "Congressional district", color: "#7cf29a", width: 2.5, glow: true },
  { key: "stateSenate", label: "State senate district", color: "#5fd4c4", width: 2.2, glow: true },
  { key: "stateHouse", label: "State house district", color: "#c8f7a0", dash: [3, 2], width: 1.6 },
];

/** Land/water + feature paint overrides on top of OpenFreeMap's "dark" style (layer ids verified against the style JSON). */
const BASE_PAINT: Record<string, [string, string | number][]> = {
  background: [["background-color", "#111d19"]], // land
  water: [["fill-color", "#060b09"]], // water; coastlines are the land/water edge, no separate coast line
  waterway: [["line-color", "#070d0b"]],
  landcover_wood: [["fill-color", "#112019"]],
  landuse_park: [["fill-color", "#112019"]],
  landuse_residential: [["fill-color", "#101b17"]],
  building: [["fill-color", "#17291f"]],
  highway_path: [["line-color", "#233a31"]],
  highway_minor: [["line-color", "#2b463a"]],
  highway_major_casing: [["line-color", "#0b1210"]],
  highway_major_inner: [["line-color", "#3b5c4d"]],
  highway_major_subtle: [["line-color", "#3b5c4d"]],
  highway_motorway_casing: [["line-color", "#0b1210"]],
  highway_motorway_inner: [["line-color", "#4f7a68"]],
  highway_motorway_subtle: [["line-color", "#3b5c4d"]],
  // Quiet road/water labels
  highway_name_other: [["text-color", "#7f948a"], ["text-halo-color", "#0b1210"], ["text-halo-width", 1.2]],
  highway_name_motorway: [["text-color", "#7f948a"], ["text-halo-color", "#0b1210"], ["text-halo-width", 1.2]],
  water_name: [["text-color", "#4f655b"], ["text-halo-color", "#070d0b"]],
};

/** Hide admin-1 labels outside the US (rough CONUS + Alaska + Hawaii polygons; label points sit near state centroids). */
const US_ZONE = {
  type: "Polygon" as const,
  coordinates: [[[-125, 48.6], [-123.2, 48.9], [-95, 49.2], [-89.5, 48.2], [-84.5, 46.9], [-82.5, 45.8], [-83, 42.3], [-79, 43.4], [-75, 44.9], [-71, 45.2], [-67.4, 47.2], [-66.9, 44.6], [-70, 41.2], [-75.5, 35], [-80, 31.5], [-80, 25], [-82, 24.8], [-85, 29.2], [-90, 29], [-97, 25.9], [-99, 26.4], [-101, 29.7], [-104.6, 29.4], [-106.6, 31.8], [-111, 31.3], [-114.8, 32.5], [-117.1, 32.5], [-125, 40], [-125, 48.6]]],
};
const US_EXTRA = [
  { type: "Polygon" as const, coordinates: [[[-170, 51], [-130, 51], [-130, 71.5], [-170, 71.5], [-170, 51]]] }, // Alaska
  { type: "Polygon" as const, coordinates: [[[-161, 18.5], [-154, 18.5], [-154, 22.5], [-161, 22.5], [-161, 18.5]]] }, // Hawaii
];
const isPoint: ExpressionSpecification = ["match", ["geometry-type"], ["MultiPoint", "Point"], true, false];
const inUS: ExpressionSpecification = ["any", ["within", US_ZONE], ...US_EXTRA.map((g) => ["within", g] as ExpressionSpecification)];
const LABEL_FONT = ["Noto Sans Regular"]; // only stack the OpenFreeMap glyph server provides for this style
const NO_MARITIME: ExpressionSpecification = ["!=", ["coalesce", ["get", "maritime"], 0], 1];

function setLayout(map: MLMap, id: string, props: Record<string, unknown>) {
  for (const [k, v] of Object.entries(props)) map.setLayoutProperty(id, k, v);
}
function setPaint(map: MLMap, id: string, props: Record<string, unknown>) {
  for (const [k, v] of Object.entries(props)) map.setPaintProperty(id, k, v);
}

/**
 * Restyle the basemap into the dark-console look.
 *  - Boundaries (source-layer "boundary"): solid thin faint lines, maritime=1 hidden (those run out over water and
 *    never match the coastline), faded in with zoom so low-zoom generalization mismatch is hard to see.
 *  - Labels: hierarchy state (small, spaced caps, muted) > city (title case, light) ; country + foreign admin-1 hidden.
 */
function darken(map: MLMap) {
  const has = (id: string) => !!map.getLayer(id);
  const attempt = (fn: () => void) => {
    try {
      fn();
    } catch {
      /* a style tweak should never break the map */
    }
  };

  for (const [id, rules] of Object.entries(BASE_PAINT)) {
    if (!has(id)) continue;
    attempt(() => rules.forEach(([prop, val]) => map.setPaintProperty(id, prop, val)));
  }

  // --- boundaries ---
  const fade = (lo: number, hi: number): ExpressionSpecification => ["interpolate", ["linear"], ["zoom"], 2, lo, 7, hi];
  attempt(() => {
    map.setFilter("boundary_state", ["all", ["==", ["get", "admin_level"], 4], NO_MARITIME]);
    setPaint(map, "boundary_state", {
      "line-color": "#4a6a5d",
      "line-dasharray": null,
      "line-blur": 0,
      "line-opacity": fade(0.7, 0.95),
      "line-width": ["interpolate", ["linear"], ["zoom"], 3, 0.8, 10, 1.2],
    });
    map.setLayoutProperty("boundary_state", "line-cap", "butt");
  });
  attempt(() => {
    map.setFilter("boundary_country_z0-4", ["all", ["==", ["get", "admin_level"], 2], ["!", ["has", "claimed_by"]], NO_MARITIME]);
    map.setFilter("boundary_country_z5-", ["all", ["==", ["get", "admin_level"], 2], NO_MARITIME]);
    for (const id of ["boundary_country_z0-4", "boundary_country_z5-"]) {
      setPaint(map, id, {
        "line-color": "#365248",
        "line-blur": 0,
        "line-opacity": fade(0.55, 1),
        "line-width": ["interpolate", ["linear"], ["zoom"], 3, 0.8, 10, 1.3],
      });
      map.setLayoutProperty(id, "line-cap", "butt");
    }
  });

  // Keep low-zoom highways quiet so they don't compete with labels/boundaries
  for (const id of ["highway_motorway_subtle", "highway_major_subtle"]) {
    if (has(id)) attempt(() => map.setPaintProperty(id, "line-opacity", ["interpolate", ["linear"], ["zoom"], 3, 0.08, 6, 0.3, 9, 0.8]));
  }

  // --- labels ---
  const halo = { "text-halo-blur": 0, "text-halo-width": 1.4 };
  for (const id of ["place_country_major", "place_country_minor", "place_country_other"]) {
    if (has(id)) attempt(() => map.setLayoutProperty(id, "visibility", "none"));
  }
  if (has("place_state")) {
    attempt(() => {
      map.setFilter("place_state", ["all", isPoint, ["==", ["get", "class"], "state"], inUS]);
      map.setLayerZoomRange("place_state", 3, 8);
      setLayout(map, "place_state", {
        "text-font": LABEL_FONT,
        "text-size": ["interpolate", ["linear"], ["zoom"], 3, 10, 6, 11.5],
        "text-transform": "uppercase",
        "text-letter-spacing": 0.14,
        "text-max-width": 7,
        "text-padding": 6,
        "symbol-avoid-edges": true,
      });
      setPaint(map, "place_state", { "text-color": "#7f948a", "text-halo-color": "#111d19", ...halo });
      map.setPaintProperty("place_state", "text-opacity", ["interpolate", ["linear"], ["zoom"], 7, 1, 8, 0]);
    });
  }
  // Cities: major only at low zoom; more as you zoom in. Title case, smaller than state labels at national zoom.
  const cityLayout = (size: unknown) => ({
    "text-font": LABEL_FONT,
    "text-size": size,
    "text-transform": "none",
    "text-letter-spacing": 0,
    "text-max-width": 8,
    "text-padding": 4,
    "symbol-avoid-edges": true,
    "icon-size": 0.3,
  });
  const cityPaint = { "text-color": "#a5b7ae", "text-halo-color": "#0b1210", "text-halo-width": 1.5, "text-halo-blur": 0, "icon-opacity": 0.5 };
  if (has("place_city_large")) {
    attempt(() => {
      map.setFilter("place_city_large", ["all", isPoint, ["==", ["get", "class"], "city"], ["<=", ["get", "rank"], 3],
        ["step", ["zoom"], ["<=", ["get", "rank"], 2], 4.5, ["<=", ["get", "rank"], 3]]]);
      setLayout(map, "place_city_large", cityLayout(["interpolate", ["linear"], ["zoom"], 3, 9.5, 8, 12, 11, 14]));
      setPaint(map, "place_city_large", cityPaint);
    });
  }
  if (has("place_city")) {
    attempt(() => {
      map.setLayerZoomRange("place_city", 6, 14);
      setLayout(map, "place_city", cityLayout(["interpolate", ["linear"], ["zoom"], 6, 9.5, 12, 12.5]));
      setPaint(map, "place_city", cityPaint);
    });
  }
  for (const id of ["place_town", "place_village", "place_suburb", "place_other"]) {
    if (!has(id)) continue;
    attempt(() => {
      setLayout(map, id, { "text-font": LABEL_FONT, "text-transform": "none", "text-letter-spacing": 0, "text-padding": 4, "symbol-avoid-edges": true });
      setPaint(map, id, { "text-color": "#8fa39a", "text-halo-color": "#0b1210", "text-halo-width": 1.3, "text-halo-blur": 0 });
    });
  }
  for (const id of ["highway_name_other", "highway_name_motorway"]) {
    if (has(id)) attempt(() => setLayout(map, id, { "text-transform": "none", "text-size": 10.5, "symbol-avoid-edges": true }));
  }
}

/** Raise all text layers above the app's district overlays so labels stay readable over fills. */
function raiseLabels(map: MLMap) {
  const ids = (map.getStyle()?.layers ?? []).filter((l) => l.type === "symbol" && !l.id.startsWith("d-")).map((l) => l.id);
  for (const id of ids) {
    try {
      map.moveLayer(id);
    } catch {
      /* ignore */
    }
  }
}

const EMPTY: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };

/** Accent pin: glowing dot with an expanding ring (ring animation disabled under reduced motion via CSS). */
function pinElement() {
  const root = document.createElement("div");
  root.setAttribute("aria-hidden", "true");
  root.style.cssText = "width:22px;height:22px;position:relative";
  const ring = document.createElement("span");
  ring.className = "bs-ping";
  ring.style.cssText = "position:absolute;inset:0;border-radius:50%;border:2px solid #7cf29a";
  const dot = document.createElement("span");
  dot.style.cssText = "position:absolute;inset:5px;border-radius:50%;background:#7cf29a;box-shadow:0 0 12px 2px rgba(124,242,154,.8),0 0 0 2px #0b1210";
  root.append(ring, dot);
  return root;
}

function bbox(features: GeoJSON.Feature[]): [number, number, number, number] | null {
  let w = 180, s = 90, e = -180, n = -90;
  let any = false;
  const walk = (c: unknown) => {
    if (Array.isArray(c) && typeof c[0] === "number") {
      const [x, y] = c as number[];
      w = Math.min(w, x); e = Math.max(e, x); s = Math.min(s, y); n = Math.max(n, y);
      any = true;
    } else if (Array.isArray(c)) c.forEach(walk);
  };
  for (const f of features) if (f.geometry && "coordinates" in f.geometry) walk(f.geometry.coordinates);
  return any ? [w, s, e, n] : null;
}

interface Props {
  boundaries?: DistrictBoundaries;
  point?: { lat: number; lng: number } | null;
  onPick?: (lat: number, lng: number) => void;
  /** Let the user drag the pin; calls onPick on drop. */
  draggablePin?: boolean;
  showLegend?: boolean;
  labels?: Partial<Record<LayerKey, string>>;
  className?: string;
  ariaLabel?: string;
  /** Render without the outer border/radius (for full-bleed hero use). The legend then floats over the map. */
  bare?: boolean;
  /** Initial camera before any point or boundaries arrive. */
  initialCenter?: [number, number];
  initialZoom?: number;
  /** Desktop only (container wider than 860px): keep the focus point clear of docked panels on the left. */
  leftInset?: number;
}

export default function MapView({ boundaries, point, onPick, showLegend = true, draggablePin = false, labels, className = "h-80", ariaLabel = "Map of your districts", bare = false, initialCenter = [-96, 38.5], initialZoom = 3, leftInset = 0 }: Props) {
  const el = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MLMap | null>(null);
  const markerRef = useRef<maplibregl.Marker | null>(null);
  const onPickRef = useRef(onPick);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [visible, setVisible] = useState<Record<LayerKey, boolean>>({ county: true, congressional: true, stateSenate: true, stateHouse: true, previousCongressional: false });

  useEffect(() => {
    onPickRef.current = onPick;
    const map = mapRef.current;
    if (map) map.getCanvas().style.cursor = onPick ? "crosshair" : "";
  }, [onPick, ready]);

  useEffect(() => {
    if (!el.current) return;
    let map: MLMap;
    try {
      map = new maplibregl.Map({
        container: el.current,
        style: "https://tiles.openfreemap.org/styles/dark",
        center: initialCenter,
        zoom: initialZoom,
        attributionControl: { compact: true },
      });
    } catch {
      setFailed(true);
      return;
    }
    mapRef.current = map;
    if (leftInset && el.current.clientWidth > 860) map.setPadding({ left: leftInset, right: 0, top: 0, bottom: 0 });
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    map.on("load", () => {
      darken(map);
      for (const l of LAYERS) {
        map.addSource(`d-${l.key}`, { type: "geojson", data: EMPTY });
        map.addLayer({ id: `d-${l.key}-fill`, type: "fill", source: `d-${l.key}`, paint: { "fill-color": l.color, "fill-opacity": l.glow ? 0.07 : 0.03 } });
        if (l.glow) {
          map.addLayer({
            id: `d-${l.key}-glow`,
            type: "line",
            source: `d-${l.key}`,
            paint: { "line-color": l.color, "line-width": 9, "line-blur": 8, "line-opacity": 0.45 },
          });
        }
        map.addLayer({
          id: `d-${l.key}-line`,
          type: "line",
          source: `d-${l.key}`,
          paint: { "line-color": l.color, "line-width": l.width, ...(l.dash ? { "line-dasharray": l.dash } : {}) },
        });
      }
      raiseLabels(map);
      // Keep the (required) attribution but start collapsed so it doesn't cover the map on phones.
      const collapse = () => {
        const attrib = el.current?.querySelector(".maplibregl-ctrl-attrib");
        attrib?.removeAttribute("open");
        attrib?.classList.remove("maplibregl-compact-show");
      };
      collapse();
      map.once("idle", collapse);
      setReady(true);
    });
    map.on("click", (e) => onPickRef.current?.(e.lngLat.lat, e.lngLat.lng));
    map.on("error", () => {
      /* tile/style hiccups should not crash the page */
    });
    return () => {
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
      setReady(false);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps -- map is created once; initial camera props are read only at mount
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const feats: GeoJSON.Feature[] = [];
    for (const l of LAYERS) {
      const f = boundaries?.[l.key];
      (map.getSource(`d-${l.key}`) as GeoJSONSource | undefined)?.setData(f ? { type: "FeatureCollection", features: [f] } : EMPTY);
      if (f && l.key !== "previousCongressional") feats.push(f);
    }
    const box = bbox(feats);
    if (box) {
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      map.fitBounds([[box[0], box[1]], [box[2], box[3]]], { padding: 40, maxZoom: 12, duration: reduce ? 0 : 900 });
    }
  }, [boundaries, ready]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    for (const l of LAYERS) {
      const v = visible[l.key] ? "visible" : "none";
      map.setLayoutProperty(`d-${l.key}-fill`, "visibility", v);
      map.setLayoutProperty(`d-${l.key}-line`, "visibility", v);
      if (l.glow) map.setLayoutProperty(`d-${l.key}-glow`, "visibility", v);
    }
  }, [visible, ready]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    markerRef.current?.remove();
    markerRef.current = null;
    if (point) {
      markerRef.current = new maplibregl.Marker({ element: pinElement(), draggable: draggablePin }).setLngLat([point.lng, point.lat]).addTo(map);
      if (draggablePin) {
        const mk = markerRef.current;
        mk.on("dragend", () => {
          const ll = mk.getLngLat();
          onPickRef.current?.(ll.lat, ll.lng);
        });
      }
      if (!boundaries) {
        const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        map.easeTo({ center: [point.lng, point.lat], zoom: Math.max(map.getZoom(), 10), duration: reduce ? 0 : 700 });
      }
    }
  }, [point, ready, boundaries, draggablePin]);

  const present = LAYERS.filter((l) => boundaries?.[l.key]);

  const legend =
    showLegend && present.length > 0 ? (
      <fieldset className={bare ? "absolute bottom-6 left-2 z-10 max-w-[calc(100%-1rem)] rounded-panel border border-line bg-panel/95 px-3 py-2" : "border-t border-line bg-panel px-3 py-2.5"}>
        <legend className="sr-only">Toggle district layers</legend>
        <div className="flex flex-wrap gap-x-4 gap-y-1.5">
          {present.map((l) => (
            <label key={l.key} className="flex cursor-pointer items-center gap-2 font-mono text-xs text-ink">
              <input
                type="checkbox"
                checked={visible[l.key]}
                onChange={(e) => setVisible((v) => ({ ...v, [l.key]: e.target.checked }))}
                className="h-4 w-4 accent-[#7cf29a]"
              />
              <span aria-hidden="true" className="inline-block h-0 w-5 border-t-[3px]" style={{ borderColor: l.color, borderStyle: l.dash ? "dashed" : "solid" }} />
              {labels?.[l.key] ?? l.label}
            </label>
          ))}
        </div>
      </fieldset>
    ) : null;

  return (
    <div className={bare ? "relative h-full w-full overflow-hidden bg-bg" : "overflow-hidden rounded-panel border border-line bg-panel"}>
      <div className={bare ? "relative h-full" : "relative"}>
        {failed ? (
          <div className={`flex items-center justify-center bg-raised p-6 text-center font-mono text-sm text-muted ${className}`}>
            The map could not be displayed in this browser. Your ballot below is unaffected.
          </div>
        ) : (
          <div ref={el} role="region" aria-label={ariaLabel} className={className} />
        )}
        {!ready && !failed && <div className="bs-skeleton pointer-events-none absolute inset-0" aria-hidden="true" />}
        {bare && legend}
      </div>
      {!bare && legend}
    </div>
  );
}
