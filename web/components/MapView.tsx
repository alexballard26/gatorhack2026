"use client";
import { useEffect, useRef, useState } from "react";
import maplibregl, { type ExpressionSpecification, type GeoJSONSource, type Map as MLMap } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { DistrictBoundaries } from "@/lib/types";
import { CONUS_BOUNDS, SHORT_LABEL, STATES, STATE_BY_ABBR } from "@/lib/geo/states";

export type MapStage = "nation" | "state" | "district";

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

const isPoint: ExpressionSpecification = ["match", ["geometry-type"], ["MultiPoint", "Point"], true, false];
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

  // Roads now sit above the district overlays (so bridges cross water correctly): keep them subtle
  for (const id of ["highway_path", "highway_minor", "highway_major_casing", "highway_major_inner", "highway_motorway_casing", "highway_motorway_inner", "railway", "railway_minor"]) {
    if (has(id)) attempt(() => map.setPaintProperty(id, "line-opacity", 0.5));
  }
  // Keep low-zoom highways quiet so they don't compete with labels/boundaries
  for (const id of ["highway_motorway_subtle", "highway_major_subtle"]) {
    if (has(id)) attempt(() => map.setPaintProperty(id, "line-opacity", ["interpolate", ["linear"], ["zoom"], 3, 0.08, 6, 0.3, 9, 0.8]));
  }

  // --- labels ---
  for (const id of ["place_country_major", "place_country_minor", "place_country_other"]) {
    if (has(id)) attempt(() => map.setLayoutProperty(id, "visibility", "none"));
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

/**
 * Final layer order, bottom to top: land/landuse/buildings, basemap boundary lines, our d-* district layers,
 * water + waterway (so every boundary stops at the shoreline), roads/bridges, then all labels.
 */
function orderLayers(map: MLMap) {
  const layers = map.getStyle()?.layers ?? [];
  const move = (id: string, before?: string) => {
    try {
      map.moveLayer(id, before);
    } catch {
      /* ignore */
    }
  };
  const firstD = layers.find((l) => l.id.startsWith("d-"))?.id;
  if (firstD) for (const l of layers) if (l.id.startsWith("boundary_")) move(l.id, firstD);
  move("water");
  move("waterway");
  const src = (l: (typeof layers)[number]) => ("source-layer" in l ? l["source-layer"] : undefined);
  for (const l of layers) if (l.type !== "symbol" && (src(l) === "transportation" || src(l) === "aeroway") && !l.id.startsWith("d-")) move(l.id);
  for (const l of layers) if (l.type === "symbol") move(l.id);
}

/** Label visibility is driven by the app stage, not by zoom. */
const CITY_IDS = ["place_city_large", "place_city", "place_town", "place_village", "place_suburb"];
const MINOR_LABEL_IDS = ["place_other", "place_state", "place_country_major", "place_country_minor", "place_country_other"];
const ROAD_LABEL_IDS = ["highway_name_other", "highway_name_motorway", "road_oneway", "road_oneway_opposite", "water_name"];

function applyStage(map: MLMap, stage: MapStage, stateAbbr?: string) {
  const vis = (id: string, on: boolean) => {
    if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", on ? "visible" : "none");
  };
  const district = stage === "district";
  for (const id of MINOR_LABEL_IDS) vis(id, false);
  for (const id of CITY_IDS) vis(id, district);
  for (const id of ROAD_LABEL_IDS) vis(id, district);
  if (district) {
    // Show every city/town, not just the big ones
    try {
      map.setFilter("place_city_large", ["all", isPoint, ["==", ["get", "class"], "city"]]);
      map.setLayerZoomRange("place_city_large", 0, 14);
      map.setLayerZoomRange("place_suburb", 10, 15);
    } catch {
      /* ignore */
    }
  }
  vis("lbl-states", stage !== "district");
  if (map.getLayer("lbl-states")) {
    map.setFilter("lbl-states", stage === "state" && stateAbbr ? ["==", ["get", "abbr"], stateAbbr] : null);
    map.setPaintProperty("lbl-states", "text-opacity", stage === "state" ? 0.55 : 1);
  }
  vis("lbl-cty", stage === "state");
  vis("d-cty-line", stage !== "nation");
  if (map.getLayer("d-cty-line")) map.setPaintProperty("d-cty-line", "line-opacity", stage === "state" ? 0.85 : 0.4);
}

const EMPTY: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };

/** Accent pin: glowing dot with an expanding ring (ring animation disabled under reduced motion via CSS). */
function pinElement(draggable: boolean) {
  const root = document.createElement("div");
  root.setAttribute("aria-hidden", "true");
  root.style.cssText = "width:22px;height:22px;position:relative" + (draggable ? ";touch-action:none" : "");
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
  /** Camera stage, controlled by the parent: nation (contiguous US) > state > district. */
  stage?: MapStage;
  /** Postal code of the state to frame in the state stage (and to load county names for). */
  stateAbbr?: string;
  /** Label for the last breadcrumb, e.g. "District 3". */
  districtLabel?: string;
  /** Breadcrumb clicks: step out to this stage. */
  onStageChange?: (stage: MapStage) => void;
  /** Click on the national map (parent resolves which state, then moves to the state stage). */
  onStateClick?: (lat: number, lng: number) => void;
  /** Click (or pin drop) in the state or district stage. */
  onPointClick?: (lat: number, lng: number) => void;
  /** Alaska / Hawaii inset buttons on the national map. */
  onStateJump?: (abbr: string) => void;
  boundaries?: DistrictBoundaries;
  point?: { lat: number; lng: number } | null;
  /** Let the user drag the pin; calls onPointClick on drop. */
  draggablePin?: boolean;
  showLegend?: boolean;
  labels?: Partial<Record<LayerKey, string>>;
  className?: string;
  ariaLabel?: string;
  /** Render without the outer border/radius (for full-bleed hero use). The legend then floats over the map. */
  bare?: boolean;
  /** Desktop only (container wider than 860px): keep the focus area clear of docked panels on the left. */
  leftInset?: number;
}

const COUNTY_CACHE = new Map<string, GeoJSON.FeatureCollection>();
const STATE_LABELS: GeoJSON.FeatureCollection = {
  type: "FeatureCollection",
  features: STATES.map((s) => ({
    type: "Feature",
    geometry: { type: "Point", coordinates: s.label },
    properties: { abbr: s.abbr, name: s.name, short: SHORT_LABEL.has(s.abbr) },
  })),
};

function countyPoints(fc: GeoJSON.FeatureCollection): GeoJSON.FeatureCollection {
  const features: GeoJSON.Feature[] = [];
  for (const f of fc.features) {
    const p = f.properties ?? {};
    const lat = parseFloat(p.INTPTLAT), lng = parseFloat(p.INTPTLON);
    if (Number.isFinite(lat) && Number.isFinite(lng)) features.push({ type: "Feature", geometry: { type: "Point", coordinates: [lng, lat] }, properties: { name: p.BASENAME ?? p.NAME } });
  }
  return { type: "FeatureCollection", features };
}

const reducedMotion = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export default function MapView({
  stage = "nation",
  stateAbbr,
  districtLabel,
  onStageChange,
  onStateClick,
  onPointClick,
  onStateJump,
  boundaries,
  point,
  showLegend = true,
  draggablePin = false,
  labels,
  className = "h-80",
  ariaLabel = "Map of your districts",
  bare = false,
  leftInset = 0,
}: Props) {
  const el = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MLMap | null>(null);
  const markerRef = useRef<maplibregl.Marker | null>(null);
  const firstFit = useRef(true);
  const [sizeKey, setSizeKey] = useState("");
  const cb = useRef({ stage, onStateClick, onPointClick });
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [visible, setVisible] = useState<Record<LayerKey, boolean>>({ county: true, congressional: true, stateSenate: true, stateHouse: true, previousCongressional: false });

  useEffect(() => {
    cb.current = { stage, onStateClick, onPointClick };
    const map = mapRef.current;
    if (map) map.getCanvas().style.cursor = (stage === "nation" ? onStateClick : onPointClick) ? "crosshair" : "default";
  }, [stage, onStateClick, onPointClick, ready]);

  useEffect(() => {
    if (!el.current) return;
    let map: MLMap;
    try {
      map = new maplibregl.Map({
        container: el.current,
        style: "https://tiles.openfreemap.org/styles/dark",
        bounds: CONUS_BOUNDS,
        attributionControl: { compact: true },
        // The camera is app-controlled: no free navigation, so the page can scroll over the map.
        scrollZoom: false,
        doubleClickZoom: false,
        boxZoom: false,
        touchZoomRotate: false,
        touchPitch: false,
        dragRotate: false,
        dragPan: false,
        keyboard: false,
      });
    } catch {
      setFailed(true);
      return;
    }
    mapRef.current = map;
    map.on("load", () => {
      darken(map);
      // Faint county lines + names for the selected state (below the district layers)
      map.addSource("cty", { type: "geojson", data: EMPTY });
      map.addSource("cty-pts", { type: "geojson", data: EMPTY });
      map.addLayer({ id: "d-cty-line", type: "line", source: "cty", paint: { "line-color": "#3b5c4d", "line-width": 0.9, "line-opacity": 0.85 } });
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
      // Our own labels: all states (national stage), county names (state stage)
      map.addSource("lbl-states-src", { type: "geojson", data: STATE_LABELS });
      map.addLayer({
        id: "lbl-states",
        type: "symbol",
        source: "lbl-states-src",
        layout: {
          // Zoom-based text-field would evaluate at the integer tile zoom, so choose by container width instead
          "text-field": (el.current?.clientWidth ?? 0) < 700 ? ["get", "abbr"] : ["case", ["get", "short"], ["get", "abbr"], ["get", "name"]],
          "text-font": LABEL_FONT,
          "text-size": ["interpolate", ["linear"], ["zoom"], 2, 9, 3, 10.5, 4, 12.5, 6, 14],
          "text-transform": "uppercase",
          "text-letter-spacing": 0.1,
          "text-max-width": 6,
          "text-allow-overlap": true,
          "text-ignore-placement": true,
        },
        paint: { "text-color": "#9bb0a6", "text-halo-color": "#0b1210", "text-halo-width": 1.5 },
      });
      map.addLayer({
        id: "lbl-cty",
        type: "symbol",
        source: "cty-pts",
        layout: {
          "text-field": ["get", "name"],
          "text-font": LABEL_FONT,
          "text-size": ["interpolate", ["linear"], ["zoom"], 5, 10, 8, 12],
          "text-max-width": 6,
          "text-padding": 3,
        },
        paint: { "text-color": "#8fa39a", "text-halo-color": "#0b1210", "text-halo-width": 1.4 },
      });
      orderLayers(map);
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
    map.on("click", (e) => {
      const { stage: st, onStateClick: sc, onPointClick: pc } = cb.current;
      if (st === "nation") sc?.(e.lngLat.lat, e.lngLat.lng);
      else pc?.(e.lngLat.lat, e.lngLat.lng);
    });
    // Re-frame the current stage when the container is resized (rotation, window resize)
    let t: ReturnType<typeof setTimeout> | undefined;
    const ro = new ResizeObserver(() => {
      clearTimeout(t);
      t = setTimeout(() => {
        firstFit.current = true; // snap rather than animate
        setSizeKey(`${el.current?.clientWidth}x${el.current?.clientHeight}`);
      }, 200);
    });
    ro.observe(el.current);
    map.on("error", () => {
      /* tile/style hiccups should not crash the page */
    });
    return () => {
      ro.disconnect();
      clearTimeout(t);
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
      setReady(false);
    };
  }, []);

  // Stage-driven label/layer visibility
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    applyStage(map, stage, stateAbbr);
  }, [stage, stateAbbr, ready]);

  // County lines + names for the selected state
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const set = (fc: GeoJSON.FeatureCollection) => {
      (map.getSource("cty") as GeoJSONSource | undefined)?.setData(fc);
      (map.getSource("cty-pts") as GeoJSONSource | undefined)?.setData(fc === EMPTY ? EMPTY : countyPoints(fc));
    };
    if (!stateAbbr || stage === "nation") return;
    const hit = COUNTY_CACHE.get(stateAbbr);
    if (hit) {
      set(hit);
      return;
    }
    set(EMPTY);
    const ctrl = new AbortController();
    fetch(`/api/counties?state=${stateAbbr}`, { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("counties"))))
      .then((fc: GeoJSON.FeatureCollection) => {
        COUNTY_CACHE.set(stateAbbr, fc);
        set(fc);
      })
      .catch(() => {
        /* county names are a nice-to-have */
      });
    return () => ctrl.abort();
  }, [stateAbbr, stage, ready]);

  // District overlays
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    for (const l of LAYERS) {
      const f = boundaries?.[l.key];
      (map.getSource(`d-${l.key}`) as GeoJSONSource | undefined)?.setData(f ? { type: "FeatureCollection", features: [f] } : EMPTY);
    }
  }, [boundaries, ready]);

  // Camera: one framing per stage
  const pointKey = !boundaries && point ? `${point.lat},${point.lng}` : "";
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || !el.current) return;
    const wide = el.current.clientWidth > 860;
    const base = 24;
    const padding = { top: base, bottom: base, right: base, left: base + (wide ? leftInset : 0) };
    const duration = firstFit.current || reducedMotion() ? 0 : 1100;
    firstFit.current = false;
    const st = stateAbbr ? STATE_BY_ABBR[stateAbbr] : undefined;
    const fit = (b: [number, number, number, number], extra: Record<string, unknown> = {}) =>
      map.fitBounds([[b[0], b[1]], [b[2], b[3]]], { padding, duration, ...extra });
    if (stage === "nation") fit([CONUS_BOUNDS[0][0], CONUS_BOUNDS[0][1], CONUS_BOUNDS[1][0], CONUS_BOUNDS[1][1]]);
    else if (stage === "state") {
      if (st) fit(st.bbox);
    } else {
      const f = boundaries?.congressional;
      const box = bbox(f ? [f] : (Object.values(boundaries ?? {}).filter(Boolean) as GeoJSON.Feature[]));
      if (box) fit(box, { maxZoom: 12 });
      else if (point) map.easeTo({ center: [point.lng, point.lat], zoom: 10, padding, duration });
      else if (st) fit(st.bbox);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- point is tracked through pointKey; leftInset is static per page
  }, [stage, stateAbbr, boundaries, pointKey, ready, sizeKey]);

  // Layer toggles (hidden entirely on the national map)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    for (const l of LAYERS) {
      const v = visible[l.key] && stage !== "nation" ? "visible" : "none";
      map.setLayoutProperty(`d-${l.key}-fill`, "visibility", v);
      map.setLayoutProperty(`d-${l.key}-line`, "visibility", v);
      if (l.glow) map.setLayoutProperty(`d-${l.key}-glow`, "visibility", v);
    }
  }, [visible, ready, stage]);

  // Pin
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    markerRef.current?.remove();
    markerRef.current = null;
    if (point) {
      const mk = new maplibregl.Marker({ element: pinElement(draggablePin), draggable: draggablePin }).setLngLat([point.lng, point.lat]).addTo(map);
      markerRef.current = mk;
      if (draggablePin) {
        mk.on("dragend", () => {
          const ll = mk.getLngLat();
          cb.current.onPointClick?.(ll.lat, ll.lng);
        });
      }
    }
  }, [point, ready, draggablePin]);

  const present = LAYERS.filter((l) => boundaries?.[l.key]);
  const stateName = stateAbbr ? STATE_BY_ABBR[stateAbbr]?.name : undefined;

  const crumbs: { stage: MapStage; label: string }[] = [{ stage: "nation", label: "United States" }];
  if (stateName && stage !== "nation") crumbs.push({ stage: "state", label: stateName });
  if (stage === "district") crumbs.push({ stage: "district", label: districtLabel ?? "District" });

  const breadcrumb = (
    <nav aria-label="Map zoom level" className={`absolute top-2 z-10 max-w-[calc(100%-1rem)] rounded-panel border border-line bg-panel/95 px-2.5 py-1.5 font-mono text-xs ${bare ? "left-2 lg:left-auto lg:right-3" : "left-2"}`}>
      <ol className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
        {crumbs.map((c, i) => {
          const last = i === crumbs.length - 1;
          return (
            <li key={c.stage} className="flex items-center gap-1.5">
              {i > 0 && (
                <span aria-hidden="true" className="text-faint">
                  &rsaquo;
                </span>
              )}
              {last ? (
                <span aria-current="location" className="font-bold text-ink">
                  {c.label}
                </span>
              ) : (
                <button type="button" onClick={() => onStageChange?.(c.stage)} className="text-accent underline underline-offset-4 hover:text-ink">
                  {c.label}
                </button>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );

  const insets =
    stage === "nation" && onStateJump ? (
      <div className="absolute bottom-9 right-2 z-10 flex gap-1.5">
        {["Alaska", "Hawaii"].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onStateJump(n === "Alaska" ? "AK" : "HI")}
            className="rounded-chip border border-line-strong bg-panel/95 px-2 py-1 font-mono text-xs text-muted hover:border-accent hover:text-ink"
          >
            {n}
          </button>
        ))}
      </div>
    ) : null;

  const legend =
    showLegend && stage === "district" && present.length > 0 ? (
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
        {!failed && breadcrumb}
        {!failed && insets}
        {bare && legend}
      </div>
      {!bare && legend}
    </div>
  );
}
