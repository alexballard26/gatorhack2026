"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { MapLazy } from "./MapLazy";
import type { MapStage } from "./MapView";
import { LocationSummary } from "./LocationSummary";
import { useCountdown } from "./countdown";
import { Panel, SectionLabel, buttonClass, fieldLabelClass, inputClass } from "./ui";
import { getDistricts, queryToString, type LocationQuery } from "@/lib/api";
import { STATE_BY_ABBR } from "@/lib/geo/states";
import type { DistrictBoundaries, VoterLocation } from "@/lib/types";

function Countdown() {
  const c = useCountdown();
  const pad = (n: number) => String(n).padStart(2, "0");
  const cells: [string, string][] = [
    [c ? String(c.days) : "--", "Days"],
    [c ? pad(c.hours) : "--", "Hrs"],
    [c ? pad(c.minutes) : "--", "Min"],
    [c ? pad(c.seconds) : "--", "Sec"],
  ];
  return (
    <Panel as="section" dock aria-labelledby="cd-h" className="pointer-events-auto">
      <SectionLabel as="h2" id="cd-h" className="mb-3">
        Election countdown
      </SectionLabel>
      <div role="timer" aria-live="off" aria-label={c ? `${c.days} days, ${c.hours} hours, ${c.minutes} minutes until polls open` : "Countdown to election day"} className="grid grid-cols-4 gap-px overflow-hidden rounded-[4px] border border-line bg-line">
        {cells.map(([v, l]) => (
          <div key={l} className="bg-bg px-2 py-3 text-center">
            <strong className="block font-mono text-[28px] font-bold leading-none tabular-nums text-ink">{v}</strong>
            <span className="mt-1.5 block font-mono text-[11px] uppercase tracking-[0.14em] text-muted">{l}</span>
          </div>
        ))}
      </div>
      <p className="mt-2 font-mono text-xs text-muted">
        {c?.passed ? "Polls are open. " : ""}Tue Nov 3, 2026 &middot; General Election &middot; polls open 7:00 AM ET
      </p>
    </Panel>
  );
}

type Mode = "address" | "map" | "manual";
const MODES: { id: Mode; label: string }[] = [
  { id: "address", label: "Enter address" },
  { id: "map", label: "Click the map" },
  { id: "manual", label: "Choose districts" },
];

export function Landing() {
  const router = useRouter();
  const sp = useSearchParams();
  const [mode, setMode] = useState<Mode>(sp.get("mode") === "manual" ? "manual" : "address");
  const [address, setAddress] = useState("");
  const [pick, setPick] = useState<{ lat: number; lng: number } | null>(null);
  const [stage, setStage] = useState<MapStage>("nation");
  const [stateAbbr, setStateAbbr] = useState<string | undefined>();
  const [found, setFound] = useState<{ loc: VoterLocation; boundaries: DistrictBoundaries } | null>(null);
  const [looking, setLooking] = useState(false);
  const lookSeq = useRef(0);
  const [m, setM] = useState({ state: sp.get("state") ?? "", county: sp.get("county") ?? "", cd: sp.get("cd") ?? "", sd: sp.get("sd") ?? "", hd: sp.get("hd") ?? "", place: sp.get("place") ?? "" });
  const [err, setErr] = useState("");
  const tabRefs = useRef<Record<Mode, HTMLButtonElement | null>>({ address: null, map: null, manual: null });

  const go = (q: LocationQuery) => router.push(`/ballot?${queryToString(q)}`);

  const resetMap = () => {
    lookSeq.current++;
    setPick(null);
    setFound(null);
    setLooking(false);
    setStage("nation");
    setStateAbbr(undefined);
  };

  const choose = (id: Mode) => {
    if (id !== mode) resetMap();
    setMode(id);
    setErr("");
  };

  // Follow-along: once the manual form holds a real state, the hero map frames it.
  useEffect(() => {
    if (mode !== "manual") return;
    const abbr = m.state.trim().toUpperCase();
    if (STATE_BY_ABBR[abbr]) {
      setStateAbbr(abbr);
      setStage("state");
    } else {
      setStage("nation");
    }
  }, [mode, m.state]);

  const stepOut = (to: MapStage) => {
    lookSeq.current++;
    setLooking(false);
    setErr("");
    setStage(to);
    if (to !== "district") {
      setPick(null);
      setFound(null);
    }
    if (to === "nation") setStateAbbr(undefined);
  };

  /** Nation stage: which state was clicked? Ask the districts API (no state polygons shipped). */
  const onStateClick = async (lat: number, lng: number) => {
    const seq = ++lookSeq.current;
    setLooking(true);
    setErr("");
    try {
      const d = await getDistricts({ lat: lat.toFixed(5), lng: lng.toFixed(5) });
      if (seq !== lookSeq.current) return;
      setStateAbbr(d.location.state);
      setStage("state");
    } catch {
      if (seq === lookSeq.current) setErr("Click inside a US state to zoom in.");
    } finally {
      if (seq === lookSeq.current) setLooking(false);
    }
  };

  /** State/district stage: drop the pin, look up the districts, frame the congressional district. */
  const onPointClick = async (lat: number, lng: number) => {
    const seq = ++lookSeq.current;
    setPick({ lat, lng });
    setLooking(true);
    setErr("");
    try {
      const d = await getDistricts({ lat: lat.toFixed(5), lng: lng.toFixed(5) });
      if (seq !== lookSeq.current) return;
      setFound({ loc: d.location, boundaries: d.boundaries });
      setStateAbbr(d.location.state);
      setStage("district");
    } catch {
      if (seq === lookSeq.current) {
        setFound(null);
        setErr("We couldn't find districts there. Click a spot inside a US state.");
      }
    } finally {
      if (seq === lookSeq.current) setLooking(false);
    }
  };

  const cd = found?.loc.congressionalDistrict;
  const districtLabel = cd ? (cd === "AL" ? "At-large district" : `District ${cd}`) : undefined;
  const hint =
    stage === "nation" ? "Click your state." : stage === "state" ? "Click near your home." : null;
  const onTabKey = (e: React.KeyboardEvent, i: number) => {
    let n = -1;
    if (e.key === "ArrowRight") n = (i + 1) % MODES.length;
    else if (e.key === "ArrowLeft") n = (i - 1 + MODES.length) % MODES.length;
    else if (e.key === "Home") n = 0;
    else if (e.key === "End") n = MODES.length - 1;
    if (n < 0) return;
    e.preventDefault();
    choose(MODES[n].id);
    tabRefs.current[MODES[n].id]?.focus();
  };

  const submitAddress = (e: React.FormEvent) => {
    e.preventDefault();
    if (address.trim().length < 5) return setErr("Enter your full street address, including city and state.");
    setErr("");
    go({ address: address.trim() });
  };
  const submitManual = (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^[A-Za-z]{2}$/.test(m.state.trim())) return setErr("Enter a two-letter state code, such as FL.");
    setErr("");
    go({ state: m.state.trim().toUpperCase(), county: m.county.trim(), cd: m.cd.trim(), sd: m.sd.trim(), hd: m.hd.trim(), place: m.place.trim() });
  };

  const field = (id: keyof typeof m, label: string, ph: string, extra = "") => (
    <div className={extra}>
      <label htmlFor={`f-${id}`} className={fieldLabelClass}>
        {label}
      </label>
      <input id={`f-${id}`} className={inputClass} placeholder={ph ? `e.g. ${ph}` : undefined} value={m[id]} onChange={(e) => setM({ ...m, [id]: e.target.value })} />
    </div>
  );

  return (
    <div>
      {/* Stage: map is the hero. Desktop = full-bleed map behind docked panels; mobile = map on top, panels stacked. */}
      <section className="relative isolate border-b border-line lg:min-h-[800px]">
        <div className="relative h-[300px] border-b border-line lg:absolute lg:inset-0 lg:z-0 lg:h-auto lg:border-b-0">
          <MapLazy
            bare
            showLegend={false}
            stage={stage}
            stateAbbr={stateAbbr}
            districtLabel={districtLabel}
            boundaries={found?.boundaries}
            point={pick}
            draggablePin={mode === "map" && Boolean(pick)}
            onStageChange={stepOut}
            onStateClick={mode === "map" ? onStateClick : undefined}
            onPointClick={mode === "map" ? onPointClick : undefined}
            onStateJump={
              mode === "map"
                ? (abbr) => {
                    setStateAbbr(abbr);
                    setStage("state");
                  }
                : undefined
            }
            leftInset={690}
            className="h-full min-h-72 w-full"
            ariaLabel="Dark map of the United States. In click-the-map mode, click your state, then click near your home to drop a pin."
          />
          {mode === "map" && hint && (
            <p className="pointer-events-none absolute left-3 top-12 z-10 rounded-chip border border-accent/60 bg-panel/95 px-2 py-1 font-mono text-xs text-accent lg:left-auto lg:right-3 lg:top-14" role="status">
              {looking ? "Looking up\u2026" : hint}
            </p>
          )}
        </div>

        <div className="pointer-events-none relative z-10 mx-auto max-w-[1360px] px-4 py-6 sm:px-6 lg:py-14">
          <div className="flex flex-col gap-4 lg:w-[520px]">
            <div className="pointer-events-auto rounded-panel lg:bg-bg/60 lg:p-4 lg:backdrop-blur-sm">
              <SectionLabel tone="accent">Nonpartisan voter intelligence</SectionLabel>
              <h1 className="bs-display mt-3 text-[clamp(38px,5.4vw,60px)] text-ink">
                Know every name <span className="text-accent">on your ballot.</span>
              </h1>
              <p className="mt-4 max-w-[46ch] text-[17px] leading-relaxed text-muted">
                Find your districts, see every race and candidate, and watch an AI research agent compile sourced, side-by-side comparisons. No endorsements. No spin.
              </p>
            </div>

            <Countdown />

            <Panel as="section" dock aria-labelledby="st-h" className="pointer-events-auto">
              <SectionLabel as="h2" id="st-h" className="mb-3">
                Choose your starting point
              </SectionLabel>
              <div role="tablist" aria-label="How to find your ballot" className="mb-4 flex gap-1">
                {MODES.map((t, i) => (
                  <button
                    key={t.id}
                    ref={(el) => {
                      tabRefs.current[t.id] = el;
                    }}
                    role="tab"
                    type="button"
                    id={`tab-${t.id}`}
                    aria-selected={mode === t.id}
                    aria-controls={`panel-${t.id}`}
                    tabIndex={mode === t.id ? 0 : -1}
                    onClick={() => choose(t.id)}
                    onKeyDown={(e) => onTabKey(e, i)}
                    className={`min-w-0 flex-1 rounded-[4px] border px-1.5 py-2.5 font-mono text-[13px] leading-tight ${
                      mode === t.id ? "border-accent bg-accent-dim text-accent" : "border-line bg-bg text-muted hover:border-line-strong hover:text-ink"
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              {mode === "address" && (
                <form id="panel-address" role="tabpanel" aria-labelledby="tab-address" onSubmit={submitAddress} noValidate>
                  <label htmlFor="address" className={fieldLabelClass}>
                    Home address
                  </label>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <input
                      id="address"
                      autoComplete="street-address"
                      className={inputClass}
                      placeholder="e.g. 1 University Ave, Gainesville, FL 32601"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                    />
                    <button type="submit" className={buttonClass("primary", "md", "sm:shrink-0")}>
                      Show my ballot
                    </button>
                  </div>
                  <p className="mt-2 font-mono text-xs leading-relaxed text-muted">We use your address only to look up your districts. It is not stored.</p>
                </form>
              )}

              {mode === "map" && (
                <div id="panel-map" role="tabpanel" aria-labelledby="tab-map">
                  <p className="mb-3 text-sm text-muted" aria-live="polite">
                    {stage === "nation" && "Step 1 of 3: click your state on the map."}
                    {stage === "state" && "Step 2 of 3: click near your home. Use the map's breadcrumb to go back."}
                    {stage === "district" && "Step 3 of 3: check the pin. Drag it or click elsewhere to adjust."}{" "}
                    Prefer the keyboard? Use the address or districts tabs.
                  </p>
                  {found && stage === "district" && (
                    <div className="mb-3">
                      <LocationSummary loc={found.loc} />
                    </div>
                  )}
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="font-mono text-xs text-ink" aria-live="polite">
                      {pick ? `Selected ${pick.lat.toFixed(4)}, ${pick.lng.toFixed(4)}` : "No location selected yet."}
                    </p>
                    <button disabled={!pick} onClick={() => pick && go({ lat: pick.lat.toFixed(5), lng: pick.lng.toFixed(5) })} className={buttonClass("primary")}>
                      Use this location
                    </button>
                  </div>
                </div>
              )}

              {mode === "manual" && (
                <form id="panel-manual" role="tabpanel" aria-labelledby="tab-manual" onSubmit={submitManual} noValidate>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {field("state", "State (2 letters)", "FL")}
                    {field("county", "County", "Alachua", "col-span-1 sm:col-span-2")}
                    {field("cd", "Congressional district", "3")}
                    {field("sd", "State senate district", "9")}
                    {field("hd", "State house district", "21")}
                    {field("place", "City / place (optional)", "Gainesville", "col-span-2 sm:col-span-3")}
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button type="submit" className={buttonClass("primary")}>
                      Show my ballot
                    </button>
                    <button type="button" onClick={() => setM({ state: "FL", county: "Alachua", cd: "3", sd: "9", hd: "21", place: "Gainesville" })} className={buttonClass("ghost")}>
                      Fill in Alachua County, FL
                    </button>
                  </div>
                </form>
              )}

              {err && (
                <p role="alert" className="mt-3 font-mono text-xs font-bold text-warn">
                  <span aria-hidden="true">{"! "}</span>
                  {err}
                </p>
              )}
            </Panel>
          </div>
        </div>
      </section>

      <section id="how" aria-labelledby="how-h" className="mx-auto max-w-[1360px] scroll-mt-16 px-4 py-12 sm:px-6 sm:py-16">
        <SectionLabel tone="accent">How it works</SectionLabel>
        <h2 id="how-h" className="bs-display mt-3 text-[clamp(26px,3.6vw,40px)] text-ink">
          From address to answers in three passes
        </h2>
        <ol className="mt-8 grid gap-4 md:grid-cols-3">
          {[
            ["01", "Locate", "Your address resolves to your congressional, state, county and local districts, drawn on a map, then to the exact races on your ballot."],
            ["02", "Verify", "Every race and ballot measure for your address, with a link to check it against your official sample ballot."],
            ["03", "Research", "Gemini Deep Research reads candidate sites, filings and news for several minutes, then writes a cited, neutral comparison you can audit line by line."],
          ].map(([n, t, d]) => (
            <Panel as="li" key={n} className="p-5 sm:p-6">
              <span className="block font-mono text-[13px] font-bold tracking-[0.12em] text-accent" aria-hidden="true">
                {n}
              </span>
              <h3 className="mt-3 text-xl font-bold text-ink">{t}</h3>
              <p className="mt-2 text-muted">{d}</p>
            </Panel>
          ))}
        </ol>
      </section>
    </div>
  );
}
