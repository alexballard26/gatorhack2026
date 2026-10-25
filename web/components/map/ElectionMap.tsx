"use client";
// Undervote election map: a hand-built SVG cartographic console (d3-geo + Census cartographic boundaries). No tiles.
// World layer = projected paths in a fixed coordinate frame, moved with one transform (scale + translate) so strokes stay
// crisp (non-scaling-stroke) and zooms animate in ~650 ms. Labels, the pin and the HUD live in screen space.
import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { geoBounds, geoContains, geoDistance } from "d3-geo";
import type { DistrictBoundaries } from "@/lib/types";
import { STATES } from "@/lib/geo/states";
import type { MapStage } from "./types";
import { GRATICULE_D, NATION_BOUNDS, NATION_D, STATE_GEO, STATE_GEOS, STATE_MESH_D, WORLD_W, fitView, path, projection, rewindFeature, toScreen, type Bounds, type View } from "./geometry";
import { Placer, nationLabels, sansWidth, type Box } from "./labels";

export type { MapStage } from "./types";

type LayerKey = keyof DistrictBoundaries;

const LAYERS: { key: LayerKey; label: string; color: string; dash?: string; width: number }[] = [
  { key: "previousCongressional", label: "Old congressional district (2024)", color: "#8a9a92", dash: "5 4", width: 1.4 },
  { key: "county", label: "County", color: "#a5b7ae", dash: "2 4", width: 1.2 },
  { key: "congressional", label: "Congressional district", color: "#7cf29a", width: 2.2 },
  { key: "stateSenate", label: "State senate district", color: "#5fd4c4", width: 1.8 },
  { key: "stateHouse", label: "State house district", color: "#c8f7a0", dash: "5 3", width: 1.3 },
];

const DURATION = 650;
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const prefersReduced = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// ---- counties (per state, from /api/counties, cached per session) ----
interface CountyGeo {
  id: string;
  name: string;
  d: string;
  bounds: Bounds;
  centroid: [number, number];
  area: number;
}
const COUNTY_CACHE = new Map<string, CountyGeo[]>();
const COUNTY_PENDING = new Map<string, Promise<CountyGeo[]>>();

function loadCounties(abbr: string): Promise<CountyGeo[]> {
  const hit = COUNTY_CACHE.get(abbr);
  if (hit) return Promise.resolve(hit);
  let p = COUNTY_PENDING.get(abbr);
  if (!p) {
    p = fetch(`/api/counties?state=${abbr}&v=2`) // v=2: the pre-SVG route returned a different shape under long cache headers
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("counties"))))
      .then((fc: GeoJSON.FeatureCollection) => {
        const list: CountyGeo[] = [];
        for (const f of fc.features) {
          const d = path(f as never);
          if (!d) continue;
          const b = path.bounds(f as never) as Bounds;
          list.push({
            id: String(f.properties?.id),
            name: String(f.properties?.name ?? ""),
            d,
            bounds: b,
            centroid: path.centroid(f as never) as [number, number],
            area: (b[1][0] - b[0][0]) * (b[1][1] - b[0][1]),
          });
        }
        COUNTY_CACHE.set(abbr, list);
        return list;
      })
      .finally(() => COUNTY_PENDING.delete(abbr));
    COUNTY_PENDING.set(abbr, p);
  }
  return p;
}

interface Place {
  name: string;
  pop: number;
  lat: number;
  lng: number;
}
const PLACE_CACHE = new Map<string, Place[]>();

// ---- static world layer (memoized: never re-renders while the camera moves) ----
const BaseLayer = memo(function BaseLayer({ stage, stateAbbr }: { stage: MapStage; stateAbbr?: string }) {
  const hi = STATE_GEO.HI;
  return (
    <>
      <path d={GRATICULE_D} className="em-grat" />
      <g className="em-states">
        {STATE_GEOS.map((s) => (
          <path
            key={s.abbr}
            d={s.d}
            data-k="s"
            data-id={s.abbr}
            className={`em-st${stage === "nation" ? "" : s.abbr === stateAbbr ? " sel" : " dim"}`}
            style={{ animationDelay: `${Math.round((s.anchor[0] / WORLD_W) * 320)}ms` }}
          />
        ))}
      </g>
      <path d={NATION_D} fill="url(#em-dots)" className="em-none" />
      <path d={STATE_MESH_D} className={`em-mesh${stage === "nation" ? "" : " quiet"}`} />
      <path d={NATION_D} className="em-coast" />
      {stage === "nation" && hi && <rect x={hi.bounds[0][0] - 4} y={hi.bounds[0][1] - 4} width={hi.bounds[1][0] - hi.bounds[0][0] + 8} height={hi.bounds[1][1] - hi.bounds[0][1] + 8} data-k="s" data-id="HI" fill="transparent" />}
    </>
  );
});

const CountyLayer = memo(function CountyLayer({ counties, faint }: { counties: CountyGeo[]; faint: boolean }) {
  return (
    <g className={faint ? "em-ctys faint" : "em-ctys"}>
      {counties.map((c) => (
        <path key={c.id} d={c.d} data-k="c" data-id={c.id} className="em-cty" />
      ))}
    </g>
  );
});

function Defs() {
  return (
    <defs>
      <pattern id="em-dots" width="7" height="7" patternUnits="userSpaceOnUse">
        <circle cx="1.5" cy="1.5" r="0.8" fill="#2f4a3f" />
      </pattern>
      <pattern id="em-hatch" width="6" height="6" patternUnits="userSpaceOnUse">
        <line x1="0" y1="0" x2="0" y2="6" stroke="#7cf29a" strokeWidth="1.1" strokeOpacity="0.5" />
      </pattern>
      <filter id="em-glow" x="-20%" y="-20%" width="140%" height="140%" colorInterpolationFilters="sRGB">
        <feGaussianBlur id="em-blur" stdDeviation="3" />
      </filter>
      <radialGradient id="em-vig" cx="50%" cy="50%" r="75%">
        <stop offset="62%" stopColor="#050908" stopOpacity="0" />
        <stop offset="100%" stopColor="#050908" stopOpacity="0.75" />
      </radialGradient>
    </defs>
  );
}

const nice = [0.5, 1, 2, 5, 10, 20, 50, 100, 200, 500, 1000];
const fmtLat = (v: number) => `${Math.abs(v).toFixed(4)}°${v >= 0 ? "N" : "S"}`;
const fmtLng = (v: number) => `${Math.abs(v).toFixed(4)}°${v >= 0 ? "E" : "W"}`;

export interface ElectionMapProps {
  /** Camera stage, controlled by the parent: nation > state > district. */
  stage?: MapStage;
  /** Postal code of the selected state (state and district stages). */
  stateAbbr?: string;
  /** Label for the last breadcrumb, e.g. "District 3". */
  districtLabel?: string;
  /** Breadcrumb clicks: step out to this stage. */
  onStageChange?: (stage: MapStage) => void;
  /** A state was clicked (or chosen in the select). */
  onStateSelect?: (abbr: string) => void;
  /** Click (or pin drop) at a point in the state or district stage. */
  onPointClick?: (lat: number, lng: number) => void;
  boundaries?: DistrictBoundaries;
  point?: { lat: number; lng: number } | null;
  draggablePin?: boolean;
  showLegend?: boolean;
  labels?: Partial<Record<LayerKey, string>>;
  /** A lookup is in flight (shows "Looking up..." in the status bar). */
  busy?: boolean;
  className?: string;
  ariaLabel?: string;
}

export default function ElectionMap({
  stage = "nation",
  stateAbbr,
  districtLabel,
  onStageChange,
  onStateSelect,
  onPointClick,
  boundaries,
  point,
  draggablePin = false,
  showLegend = true,
  labels,
  busy = false,
  className = "lg:h-full",
  ariaLabel = "Map of the United States",
}: ElectionMapProps) {
  const areaRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const worldRef = useRef<SVGGElement>(null);
  const pinRef = useRef<SVGGElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  const coordRef = useRef<HTMLSpanElement>(null);
  const curRef = useRef<View | null>(null);
  const rafRef = useRef(0);
  const lastSize = useRef("");
  const drag = useRef<{ lat: number; lng: number } | null>(null);
  const justDragged = useRef(false);

  const [size, setSize] = useState({ w: 0, h: 0 });
  const [ready, setReady] = useState(false);
  const [moving, setMoving] = useState(false);
  const [hover, setHover] = useState<{ k: string; id: string } | null>(null);
  const [counties, setCounties] = useState<CountyGeo[]>([]);
  const [places, setPlaces] = useState<Place[]>([]);
  const [visible, setVisible] = useState<Record<LayerKey, boolean>>({ county: true, congressional: true, stateSenate: true, stateHouse: true, previousCongressional: false });

  const sel = stateAbbr ? STATE_GEO[stateAbbr] : undefined;
  const wide = size.w >= 600;

  // ---- measure ----
  useLayoutEffect(() => {
    const el = areaRef.current;
    if (!el) return;
    const read = () => setSize({ w: el.clientWidth, h: el.clientHeight });
    read();
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // ---- data: counties for the selected state ----
  useEffect(() => {
    let live = true;
    if (!stateAbbr || stage === "nation") {
      setCounties([]);
      return;
    }
    const hit = COUNTY_CACHE.get(stateAbbr);
    if (hit) setCounties(hit);
    else {
      setCounties([]);
      loadCounties(stateAbbr).then((l) => live && setCounties(l)).catch(() => {});
    }
    return () => {
      live = false;
    };
  }, [stateAbbr, stage]);

  // ---- data: places inside the current district's bounding box ----
  const wound = useMemo(() => {
    const out: DistrictBoundaries = {};
    for (const l of LAYERS) {
      const f = boundaries?.[l.key];
      if (f) out[l.key] = rewindFeature(f);
    }
    return out;
  }, [boundaries]);
  const cdFeature = wound.congressional;
  useEffect(() => {
    let live = true;
    if (stage !== "district") {
      setPlaces([]);
      return;
    }
    let box: [number, number, number, number] | null = null;
    if (cdFeature) {
      const [[w, s], [e, n]] = geoBounds(cdFeature as never);
      if (w < e) box = [w, s, e, n];
    }
    if (!box && stateAbbr) {
      const st = STATES.find((x) => x.abbr === stateAbbr);
      if (st) box = st.bbox;
    }
    if (!box) return;
    const key = box.map((v) => v.toFixed(2)).join(",");
    const hit = PLACE_CACHE.get(key);
    if (hit) {
      setPlaces(hit);
      return;
    }
    fetch(`/api/places?bbox=${key}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("places"))))
      .then((j: { places: Place[] }) => {
        PLACE_CACHE.set(key, j.places);
        if (live) setPlaces(j.places);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [stage, cdFeature, stateAbbr]);

  // ---- target camera ----
  const pinWorld = useMemo(() => (point ? (projection([point.lng, point.lat]) as [number, number] | null) : null), [point]);
  const target = useMemo<View | null>(() => {
    if (!size.w || !size.h) return null;
    const pad = wide ? { t: 56, r: 36, b: 36, l: 36 } : { t: 50, r: 14, b: 26, l: 14 };
    if (stage === "nation" || !sel) {
      const p = { ...pad, r: pad.r + (wide ? 10 : 8) };
      return fitView(NATION_BOUNDS, size.w, size.h, p);
    }
    if (stage === "state") return fitView(sel.bounds, size.w, size.h, pad);
    if (cdFeature) {
      const b = path.bounds(cdFeature as never) as Bounds;
      if (Number.isFinite(b[0][0])) return fitView(b, size.w, size.h, pad);
    }
    return fitView(sel.bounds, size.w, size.h, pad);
  }, [stage, sel, cdFeature, size.w, size.h, wide]);

  const pinWorldRef = useRef<[number, number] | null>(null);
  pinWorldRef.current = pinWorld;
  const applyView = useCallback((v: View) => {
    curRef.current = v;
    worldRef.current?.setAttribute("transform", `translate(${v.tx} ${v.ty}) scale(${v.k})`);
    const svg = svgRef.current;
    if (svg) {
      svg.querySelector("#em-dots")?.setAttribute("patternTransform", `scale(${1 / v.k})`);
      svg.querySelector("#em-hatch")?.setAttribute("patternTransform", `rotate(45) scale(${1 / v.k})`);
      svg.querySelector("#em-blur")?.setAttribute("stdDeviation", String(3.2 / v.k));
    }
    const pin = pinRef.current;
    if (pin && pinWorldRef.current) {
      const [sx, sy] = toScreen(v, pinWorldRef.current);
      pin.setAttribute("transform", `translate(${sx} ${sy})`);
    }
  }, []);

  // Pin follows the (possibly mid-flight) camera whenever the point changes.
  useLayoutEffect(() => {
    const v = curRef.current;
    const pin = pinRef.current;
    if (!v || !pin) return;
    if (pinWorld) {
      const [sx, sy] = toScreen(v, pinWorld);
      pin.setAttribute("transform", `translate(${sx} ${sy})`);
    }
  }, [pinWorld]);

  // ---- camera animation: interpolate center + log(scale) over DURATION ----
  useLayoutEffect(() => {
    if (!target) {
      setMoving(false);
      return;
    }
    cancelAnimationFrame(rafRef.current);
    const from = curRef.current;
    const sizeKey = `${size.w}x${size.h}`;
    const resized = sizeKey !== lastSize.current;
    lastSize.current = sizeKey;
    if (!from || resized || prefersReduced()) {
      applyView(target);
      setReady(true);
      setMoving(false);
      return;
    }
    const cxy = (v: View): [number, number] => [(size.w / 2 - v.tx) / v.k, (size.h / 2 - v.ty) / v.k];
    const [fx, fy] = cxy(from);
    const [tx2, ty2] = cxy(target);
    const t0 = performance.now();
    setMoving(true);
    const step = (now: number) => {
      const u = Math.min(1, (now - t0) / DURATION);
      const e = ease(u);
      const k = from.k * Math.pow(target.k / from.k, e);
      const cx = fx + (tx2 - fx) * e;
      const cy = fy + (ty2 - fy) * e;
      applyView({ k, tx: size.w / 2 - cx * k, ty: size.h / 2 - cy * k });
      if (u < 1) rafRef.current = requestAnimationFrame(step);
      else {
        applyView(target);
        setReady(true);
        setMoving(false);
      }
    };
    rafRef.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- size only matters through target
  }, [target, applyView]);

  // ---- pointer helpers ----
  const toLatLng = useCallback((clientX: number, clientY: number): { lat: number; lng: number } | null => {
    const svg = svgRef.current;
    const v = curRef.current;
    if (!svg || !v) return null;
    const r = svg.getBoundingClientRect();
    const ll = projection.invert?.([(clientX - r.left - v.tx) / v.k, (clientY - r.top - v.ty) / v.k]);
    return ll && Number.isFinite(ll[0]) ? { lat: ll[1], lng: ll[0] } : null;
  }, []);

  const hitOf = (t: EventTarget | null): { k: string; id: string } | null => {
    const el = (t as Element | null)?.closest?.("[data-k]");
    return el ? { k: el.getAttribute("data-k")!, id: el.getAttribute("data-id")! } : null;
  };

  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (drag.current && e.buttons) {
      const ll = toLatLng(e.clientX, e.clientY);
      const v = curRef.current;
      if (ll && v) {
        drag.current = ll;
        const wp = projection([ll.lng, ll.lat]);
        if (wp) pinRef.current?.setAttribute("transform", `translate(${toScreen(v, wp as [number, number]).join(" ")})`);
      }
      return;
    }
    const h = hitOf(e.target);
    const ll = toLatLng(e.clientX, e.clientY);
    if (coordRef.current) coordRef.current.textContent = ll ? `${fmtLat(ll.lat)}  ${fmtLng(ll.lng)}` : "";
    const hv = h && (h.k === "s" || h.k === "c") ? h : null;
    setHover((p) => (p?.k === hv?.k && p?.id === hv?.id ? p : hv));
    const tip = tipRef.current;
    const area = areaRef.current;
    if (tip && area) {
      const r = area.getBoundingClientRect();
      tip.style.transform = `translate(${Math.min(e.clientX - r.left + 14, r.width - 150)}px, ${Math.max(e.clientY - r.top - 34, 4)}px)`;
    }
  };

  const onLeave = () => {
    if (coordRef.current) coordRef.current.textContent = "";
    setHover(null);
  };

  const onClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (justDragged.current || moving) return;
    if ((e.target as Element).closest("[data-pin]")) return;
    const h = hitOf(e.target);
    if (!h) return;
    if (h.k === "s") {
      if (stage === "nation" || (stage === "state" && h.id !== stateAbbr)) {
        onStateSelect?.(h.id);
        return;
      }
      if (stage === "district" && h.id !== stateAbbr && !onPointClick) return;
    }
    if (stage === "nation") return;
    const ll = toLatLng(e.clientX, e.clientY);
    if (ll) onPointClick?.(ll.lat, ll.lng);
  };

  const onPinDown = (e: React.PointerEvent<SVGGElement>) => {
    if (!draggablePin || !onPointClick) return;
    e.stopPropagation();
    svgRef.current?.setPointerCapture(e.pointerId);
    drag.current = point ?? null;
  };
  const onUp = () => {
    const d = drag.current;
    drag.current = null;
    if (d) {
      justDragged.current = true;
      setTimeout(() => (justDragged.current = false), 0);
      onPointClick?.(d.lat, d.lng);
    }
  };

  // ---- derived overlays ----
  const countyById = useMemo(() => new Map(counties.map((c) => [c.id, c])), [counties]);
  const hoverD = useMemo(() => {
    if (!hover || moving) return null;
    if (hover.k === "s") return stage === "district" ? null : STATE_GEO[hover.id]?.d ?? null;
    if (hover.k === "c") return stage === "state" ? countyById.get(hover.id)?.d ?? null : null;
    return null;
  }, [hover, moving, stage, countyById]);
  const hoverText = useMemo(() => {
    if (!hover || moving) return "";
    if (hover.k === "s") return stage === "district" ? "" : STATE_GEO[hover.id]?.name ?? "";
    if (hover.k === "c") return stage === "state" ? `${countyById.get(hover.id)?.name ?? ""} County` : "";
    return "";
  }, [hover, moving, stage, countyById]);

  const present = LAYERS.filter((l) => boundaries?.[l.key]);
  const featD = useMemo(() => {
    const out: Partial<Record<LayerKey, string>> = {};
    for (const l of LAYERS) {
      const f = wound[l.key];
      if (f && l.key !== "county") out[l.key] = path(f as never) ?? undefined;
    }
    return out;
  }, [wound]);

  // Labels/scale are laid out against the settled camera (the target), never a separately tracked copy.
  const view = target;
  const labelsOut = useMemo(() => {
    if (!view || !size.w) return null;
    const placer = new Placer(size.w, size.h);
    // keep labels clear of the HUD (breadcrumb, compass, scale bar)
    placer.add({ x0: 0, y0: 0, x1: Math.min(size.w - 40, 300), y1: 46 });
    placer.add({ x0: size.w - 40, y0: 0, x1: size.w, y1: 46 });
    placer.add({ x0: 0, y0: size.h - 34, x1: 150, y1: size.h });
    const pinS = pinWorld ? toScreen(view, pinWorld) : null;
    const pinBox: Box | null = pinS ? { x0: pinS[0] - 14, y0: pinS[1] - 14, x1: pinS[0] + 14, y1: pinS[1] + 14 } : null;
    const addPin = () => {
      if (pinBox) placer.add(pinBox);
    };
    if (stage !== "district") addPin();
    if (stage === "nation") return { kind: "nation" as const, items: nationLabels(view, size.w, size.h, (lng, lat) => projection([lng, lat]) as [number, number] | null) };
    if (stage === "state") {
      const items: { id: string; text: string; x: number; y: number; size: number }[] = [];
      for (const c of [...counties].sort((a, b) => b.area - a.area)) {
        const [x, y] = toScreen(view, c.centroid);
        const bw = (c.bounds[1][0] - c.bounds[0][0]) * view.k;
        const bh = (c.bounds[1][1] - c.bounds[0][1]) * view.k;
        for (const fs of [11.5, 10]) {
          const tw = sansWidth(c.name, fs);
          if (tw > bw * 0.9 || fs * 1.4 > bh) continue;
          const box: Box = { x0: x - tw / 2, y0: y - fs * 0.75, x1: x + tw / 2, y1: y + fs * 0.35 };
          if (placer.fits(box, 3)) {
            placer.add(box);
            items.push({ id: c.id, text: c.name, x, y, size: fs });
            break;
          }
        }
      }
      // neighbor state codes for context
      const nb: { id: string; text: string; x: number; y: number }[] = [];
      for (const s of STATE_GEOS) {
        if (s.abbr === stateAbbr) continue;
        const [x, y] = toScreen(view, s.anchor);
        const box: Box = { x0: x - 12, y0: y - 8, x1: x + 12, y1: y + 6 };
        if (placer.fits(box, 6)) {
          placer.add(box);
          nb.push({ id: s.abbr, text: s.abbr, x, y });
        }
      }
      return { kind: "state" as const, items, nb };
    }
    // district: biggest places that do not collide
    const items: { id: string; text: string; x: number; y: number; size: number; dotOnly: boolean; inside: boolean; right: boolean; dx: number }[] = [];
    const sorted = [...places].sort((a, b) => b.pop - a.pop);
    let n = 0;
    let pinPlaced = false;
    addPin();
    for (const p of sorted) {
      const wp = projection([p.lng, p.lat]) as [number, number] | null;
      if (!wp || (sel && !geoContains(sel.feature as never, [p.lng, p.lat]))) continue;
      const [x, y] = toScreen(view, wp);
      const fs = n < 3 ? 13.5 : n < 8 ? 12 : 11;
      const tw = sansWidth(p.name, fs);
      // the place the pin sits on: label it beside the pin ring instead of dropping it
      const underPin = !pinPlaced && !!pinS && Math.hypot(pinS[0] - x, pinS[1] - y) < 18;
      const dx = underPin ? 17 : 7;
      const boxFor = (r: boolean): Box => (r ? { x0: x - 4, y0: y - fs * 0.8, x1: x + dx + 2 + tw, y1: y + fs * 0.45 } : { x0: x - dx - 2 - tw, y0: y - fs * 0.8, x1: x + 4, y1: y + fs * 0.45 });
      const ok = (b: Box) => placer.fits(b, 4) || (underPin && placer.fitsIgnoring(b, pinBox));
      const right = ok(boxFor(true)) ? true : ok(boxFor(false)) ? false : null;
      if (right === null) continue;
      const box = boxFor(right);
      placer.add(box);
      if (underPin) pinPlaced = true;
      n++;
      const inside = cdFeature ? geoContains(cdFeature as never, [p.lng, p.lat]) : true;
      items.push({ id: p.name, text: p.name, x, y, size: fs, dotOnly: underPin, inside, right, dx });
      if (n >= 16) break;
    }
    return { kind: "district" as const, items };
  }, [view, size.w, size.h, stage, counties, places, stateAbbr, pinWorld, cdFeature, sel]);

  // scale bar
  const scale = useMemo(() => {
    if (!view || !size.w) return null;
    const cx = (size.w / 2 - view.tx) / view.k;
    const cy = (size.h / 2 - view.ty) / view.k;
    const a = projection.invert?.([cx, cy]);
    const b = projection.invert?.([cx + 100 / view.k, cy]);
    if (!a || !b) return null;
    const mi = geoDistance(a, b) * 3958.8;
    const pick = [...nice].reverse().find((n) => (n / mi) * 100 <= 110) ?? nice[0];
    return { px: (pick / mi) * 100, label: `${pick} MI` };
  }, [view, size.w, size.h]);

  const stateName = sel?.name;
  const crumbs: { stage: MapStage; label: string }[] = [{ stage: "nation", label: "United States" }];
  if (stateName && stage !== "nation") crumbs.push({ stage: "state", label: stateName });
  if (stage === "district") crumbs.push({ stage: "district", label: districtLabel ?? "District" });

  const stageNo = stage === "nation" ? 1 : stage === "state" ? 2 : 3;
  const readout = [`STAGE ${stageNo}/3`, stage === "nation" ? "UNITED STATES" : (stateName ?? "").toUpperCase(), stage === "state" && counties.length ? `${counties.length} COUNTIES` : stage === "district" ? (districtLabel ?? "").toUpperCase() : stage === "nation" ? "50 STATES + DC" : ""]
    .filter(Boolean)
    .join(" · ");

  const prompt = busy
    ? "Looking up…"
    : stage === "nation" && onStateSelect
      ? "Click your state"
      : stage === "state" && onPointClick
        ? "Click near your home"
        : stage === "district" && onPointClick
          ? draggablePin
            ? "Drag the pin or click to move it"
            : "Click to move the pin"
          : "";

  const pinCoords = point ? `${fmtLat(point.lat)}  ${fmtLng(point.lng)}` : "";
  const showHud = ready && Boolean(view);

  return (
    <div className={`em-root flex min-h-0 flex-col overflow-hidden rounded-panel border border-line ${className}`} data-stage={stage} data-moving={moving ? "1" : "0"}>
      <div ref={areaRef} className="relative h-[380px] min-h-0 overflow-hidden sm:h-[440px] lg:h-auto lg:flex-1">
        <svg
          ref={svgRef}
          role="img"
          aria-label={ariaLabel}
          width={size.w}
          height={size.h}
          className="absolute inset-0 block h-full w-full"
          onPointerMove={onMove}
          onPointerLeave={onLeave}
          onPointerUp={onUp}
          onClick={onClick}
        >
          <Defs />
          <rect width="100%" height="100%" className="em-ocean" />
          <g ref={worldRef} className="em-world">
            <BaseLayer stage={stage} stateAbbr={stateAbbr} />

            {stage !== "nation" && sel && (
              <>
                {counties.length > 0 && <CountyLayer counties={counties} faint={stage === "district"} />}
                <path d={sel.d} className="em-sel-glow" filter="url(#em-glow)" style={{ opacity: moving ? 0 : stage === "district" ? 0.12 : 0.3 }} />
                <path d={sel.d} className={`em-sel-line${stage === "district" ? " quiet" : ""}`} />
                <path d={sel.d} data-k="p" className="em-hit" />
              </>
            )}

            {stage === "district" && sel && (
              <>
                <clipPath id="em-clip">
                  <path d={sel.d} />
                </clipPath>
                <g clipPath="url(#em-clip)" className="em-districts">
                  {boundaries?.stateHouse && visible.stateHouse && featD.stateHouse && <path d={featD.stateHouse} className="em-sh" />}
                  {boundaries?.stateSenate && visible.stateSenate && featD.stateSenate && (
                    <>
                      <path d={featD.stateSenate} className="em-ss-fill" />
                      <path d={featD.stateSenate} className="em-ss" />
                    </>
                  )}
                  {boundaries?.previousCongressional && visible.previousCongressional && featD.previousCongressional && <path d={featD.previousCongressional} className="em-old" />}
                  {boundaries?.congressional && visible.congressional && featD.congressional && (
                    <>
                      <path d={featD.congressional} className="em-cd-glow" filter="url(#em-glow)" style={{ opacity: moving ? 0 : 0.6 }} />
                      <path d={featD.congressional} className="em-cd-fill" />
                      <path d={featD.congressional} fill="url(#em-hatch)" className="em-none" />
                      <path d={featD.congressional} className="em-cd" />
                    </>
                  )}
                </g>
              </>
            )}

            {hoverD && (
              <>
                <path d={hoverD} className="em-hover-glow" />
                <path d={hoverD} className="em-hover" />
              </>
            )}
          </g>

          <rect width="100%" height="100%" fill="url(#em-vig)" pointerEvents="none" />

          {/* screen-space layer: constant-size text, leader lines, pin */}
          <g className="em-labels" style={{ opacity: moving ? 0 : 1 }} pointerEvents="none" aria-hidden="true">
            {labelsOut?.kind === "nation" &&
              labelsOut.items.map((l) => (
                <g key={l.abbr}>
                  {l.leader && <polyline points={`${l.leader[0]},${l.leader[1]} ${l.leader[2]},${l.leader[3]}`} className="em-leader" />}
                  <text x={l.x} y={l.y} fontSize={l.size} textAnchor={l.anchor} dominantBaseline="central" className={l.mono ? "em-lbl mono" : "em-lbl"}>
                    {l.text}
                  </text>
                </g>
              ))}
            {labelsOut?.kind === "state" && (
              <>
                {labelsOut.nb.map((l) => (
                  <text key={l.id} x={l.x} y={l.y} fontSize={10} textAnchor="middle" dominantBaseline="central" className="em-lbl mono faint">
                    {l.text}
                  </text>
                ))}
                {labelsOut.items.map((l) => (
                  <text key={l.id} x={l.x} y={l.y} fontSize={l.size} textAnchor="middle" dominantBaseline="central" className="em-lbl cty">
                    {l.text}
                  </text>
                ))}
              </>
            )}
            {labelsOut?.kind === "district" &&
              labelsOut.items.map((l) => (
                <g key={l.id} className={l.inside ? "" : "outside"}>
                  {!l.dotOnly && <circle cx={l.x} cy={l.y} r={2.2} className="em-place-dot" />}
                  <text x={l.right ? l.x + l.dx : l.x - l.dx} y={l.y} fontSize={l.size} textAnchor={l.right ? "start" : "end"} dominantBaseline="central" className="em-lbl place">
                    {l.text}
                  </text>
                </g>
              ))}
          </g>

          <g ref={pinRef} data-pin="1" onPointerDown={onPinDown} className={draggablePin ? "em-pin drag" : "em-pin"} style={{ display: pinWorld ? undefined : "none" }}>
            <circle r="11" className="em-pin-ring" />
            <circle r="13" fill="transparent" />
            <circle r="9" className="em-pin-halo" />
            <circle r="5" className="em-pin-dot" />
          </g>
        </svg>

        {showHud && (
          <>
            {/* corner brackets */}
            <span aria-hidden="true" className="em-corner tl" />
            <span aria-hidden="true" className="em-corner tr" />
            <span aria-hidden="true" className="em-corner bl" />
            <span aria-hidden="true" className="em-corner br" />

            <nav aria-label="Map zoom level" className="absolute left-3 top-3 z-10 max-w-[calc(100%-4.5rem)] rounded-chip border border-line-strong bg-bg/90 px-2.5 py-1.5 font-mono text-xs backdrop-blur-sm">
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

            <div aria-hidden="true" className="pointer-events-none absolute right-3 top-3 z-10 flex flex-col items-center font-mono text-[10px] leading-none text-muted">
              <svg width="18" height="26" viewBox="0 0 18 26" fill="none">
                <path d="M9 1 L13 12 L9 10 L5 12 Z" fill="#7cf29a" />
                <path d="M9 10 V25" stroke="#365248" strokeWidth="1" />
                <path d="M3 18 H15" stroke="#365248" strokeWidth="1" />
              </svg>
              <span className="mt-0.5">N</span>
            </div>

            {scale && (
              <div aria-hidden="true" className="pointer-events-none absolute bottom-3 left-3 z-10 font-mono text-[10px] leading-none text-muted">
                <div style={{ width: scale.px }} className="mb-1 h-1.5 border-x border-b border-muted/80" />
                ~{scale.label}
              </div>
            )}
            <div aria-hidden="true" className="pointer-events-none absolute bottom-3 right-3 z-10 hidden font-mono text-[10px] leading-none text-faint sm:block">
              <span ref={coordRef} />
            </div>
          </>
        )}

        <div ref={tipRef} aria-hidden="true" className="pointer-events-none absolute left-0 top-0 z-20" style={{ opacity: hoverText ? 1 : 0 }}>
          <span className="whitespace-nowrap rounded-chip border border-accent/70 bg-bg px-1.5 py-1 font-mono text-[11px] text-ink">{hoverText}</span>
        </div>
      </div>

      {/* status bar: never covers the geography */}
      <div className="border-t border-line bg-panel">
        {showLegend && stage === "district" && present.length > 0 && (
          <fieldset className="border-b border-line px-3 py-2">
            <legend className="sr-only">Toggle district layers</legend>
            <div className="grid grid-cols-1 gap-x-4 gap-y-1.5 min-[480px]:grid-cols-2 sm:flex sm:flex-wrap">
              {present.map((l) => (
                <label key={l.key} className="flex cursor-pointer items-center gap-2 font-mono text-[11px] leading-tight text-ink sm:text-xs">
                  <input type="checkbox" checked={visible[l.key]} onChange={(e) => setVisible((v) => ({ ...v, [l.key]: e.target.checked }))} className="h-4 w-4 accent-[#7cf29a]" />
                  <svg aria-hidden="true" width="22" height="6" className="shrink-0">
                    <line x1="0" y1="3" x2="22" y2="3" stroke={l.color} strokeWidth={l.key === "congressional" ? 3 : 2} strokeDasharray={l.dash} />
                  </svg>
                  {labels?.[l.key] ?? l.label}
                </label>
              ))}
            </div>
          </fieldset>
        )}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-3 py-2 font-mono text-[11px] text-muted">
          <span role="status" aria-live="polite" className={`flex items-center gap-1.5 font-bold ${prompt ? "text-accent" : ""}`}>
            {prompt && <span aria-hidden="true" className={busy ? "bs-pulse" : ""}>&#9656;</span>}
            {prompt || " "}
          </span>
          <span className="tracking-[0.08em]">{readout}</span>
          {pinCoords && <span className="hidden sm:inline">PIN {pinCoords}</span>}
          <label className="ml-auto flex items-center gap-2">
            <span className="sr-only">Choose your state</span>
            <select
              value={stateAbbr ?? ""}
              onChange={(e) => e.target.value && onStateSelect?.(e.target.value)}
              disabled={!onStateSelect}
              className="max-w-[11rem] rounded-chip border border-field bg-bg px-1.5 py-1 font-mono text-[11px] text-ink focus-visible:border-accent"
            >
              <option value="">Choose your state</option>
              {[...STATES].sort((a, b) => a.name.localeCompare(b.name)).map((s) => (
                <option key={s.abbr} value={s.abbr}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>
    </div>
  );
}

