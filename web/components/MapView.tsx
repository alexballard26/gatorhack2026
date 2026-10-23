"use client";
import { useEffect, useRef, useState } from "react";
import maplibregl, { type GeoJSONSource, type Map as MLMap } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { DistrictBoundaries } from "@/lib/types";

type LayerKey = keyof DistrictBoundaries;

const LAYERS: { key: LayerKey; label: string; color: string; dash?: number[] }[] = [
  { key: "county", label: "County", color: "#475569", dash: [3, 2] },
  { key: "congressional", label: "Congressional district", color: "#0f766e" },
  { key: "stateSenate", label: "State senate district", color: "#b45309" },
  { key: "stateHouse", label: "State house district", color: "#7e22ce" },
];

const EMPTY: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };

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
}

export default function MapView({ boundaries, point, onPick, showLegend = true, draggablePin = false, labels, className = "h-80", ariaLabel = "Map of your districts" }: Props) {
  const el = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MLMap | null>(null);
  const markerRef = useRef<maplibregl.Marker | null>(null);
  const onPickRef = useRef(onPick);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [visible, setVisible] = useState<Record<LayerKey, boolean>>({ county: true, congressional: true, stateSenate: true, stateHouse: true });

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
        style: "https://tiles.openfreemap.org/styles/positron",
        center: [-96, 38.5],
        zoom: 3,
        attributionControl: { compact: true },
      });
    } catch {
      setFailed(true);
      return;
    }
    mapRef.current = map;
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    map.on("load", () => {
      for (const l of LAYERS) {
        map.addSource(`d-${l.key}`, { type: "geojson", data: EMPTY });
        map.addLayer({ id: `d-${l.key}-fill`, type: "fill", source: `d-${l.key}`, paint: { "fill-color": l.color, "fill-opacity": 0.06 } });
        map.addLayer({
          id: `d-${l.key}-line`,
          type: "line",
          source: `d-${l.key}`,
          paint: { "line-color": l.color, "line-width": 2.5, ...(l.dash ? { "line-dasharray": l.dash } : {}) },
        });
      }
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
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const feats: GeoJSON.Feature[] = [];
    for (const l of LAYERS) {
      const f = boundaries?.[l.key];
      (map.getSource(`d-${l.key}`) as GeoJSONSource | undefined)?.setData(f ? { type: "FeatureCollection", features: [f] } : EMPTY);
      if (f) feats.push(f);
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
    }
  }, [visible, ready]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    markerRef.current?.remove();
    markerRef.current = null;
    if (point) {
      markerRef.current = new maplibregl.Marker({ color: "#0f766e", draggable: draggablePin }).setLngLat([point.lng, point.lat]).addTo(map);
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

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className="relative">
        {failed ? (
          <div className={`flex items-center justify-center bg-slate-100 p-6 text-center text-sm text-slate-700 ${className}`}>
            The map could not be displayed in this browser. Your ballot below is unaffected.
          </div>
        ) : (
          <div ref={el} role="region" aria-label={ariaLabel} className={className} />
        )}
        {!ready && !failed && <div className="bs-skeleton pointer-events-none absolute inset-0" aria-hidden="true" />}
      </div>
      {showLegend && present.length > 0 && (
        <fieldset className="border-t border-slate-200 px-3 py-2">
          <legend className="sr-only">Toggle district layers</legend>
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            {present.map((l) => (
              <label key={l.key} className="flex cursor-pointer items-center gap-2 text-sm text-slate-800">
                <input
                  type="checkbox"
                  checked={visible[l.key]}
                  onChange={(e) => setVisible((v) => ({ ...v, [l.key]: e.target.checked }))}
                  className="h-4 w-4 accent-teal-700"
                />
                <span aria-hidden="true" className="inline-block h-0 w-5 border-t-[3px]" style={{ borderColor: l.color, borderStyle: l.dash ? "dashed" : "solid" }} />
                {labels?.[l.key] ?? l.label}
              </label>
            ))}
          </div>
        </fieldset>
      )}
    </div>
  );
}
