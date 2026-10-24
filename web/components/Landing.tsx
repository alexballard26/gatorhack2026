"use client";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { MapLazy } from "./MapLazy";
import { queryToString, type LocationQuery } from "@/lib/api";

const ELECTION = new Date("2026-11-03T12:00:00-05:00");

function ElectionChip() {
  const [days, setDays] = useState<number | null>(null);
  useEffect(() => {
    setDays(Math.ceil((ELECTION.getTime() - Date.now()) / 86400000));
  }, []);
  let tail = "";
  if (days !== null) tail = days > 1 ? ` — ${days} days away` : days === 1 ? " — tomorrow" : days === 0 ? " — today" : " — has passed";
  return (
    <p className="inline-flex items-center gap-2 rounded-full border border-teal-300 bg-teal-50 px-3 py-1 text-sm font-medium text-teal-900">
      <span aria-hidden="true">{"🗳️"}</span>
      Election day: Tue, Nov 3, 2026{tail}
    </p>
  );
}

type Mode = "address" | "map" | "manual";
const MODES: { id: Mode; label: string }[] = [
  { id: "address", label: "Enter address" },
  { id: "map", label: "Click the map" },
  { id: "manual", label: "Choose districts" },
];

const inputCls =
  "w-full rounded-lg border border-slate-400 bg-white px-3 py-2.5 text-slate-900 placeholder:text-slate-500 focus:border-teal-700";

export function Landing() {
  const router = useRouter();
  const sp = useSearchParams();
  const [mode, setMode] = useState<Mode>(sp.get("mode") === "manual" ? "manual" : "address");
  const [address, setAddress] = useState("");
  const [pick, setPick] = useState<{ lat: number; lng: number } | null>(null);
  const [m, setM] = useState({ state: sp.get("state") ?? "", county: sp.get("county") ?? "", cd: sp.get("cd") ?? "", sd: sp.get("sd") ?? "", hd: sp.get("hd") ?? "", place: sp.get("place") ?? "" });
  const [err, setErr] = useState("");

  const go = (q: LocationQuery) => router.push(`/ballot?${queryToString(q)}`);

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
      <label htmlFor={`f-${id}`} className="mb-1 block text-sm font-medium text-slate-800">
        {label}
      </label>
      <input id={`f-${id}`} className={inputCls} placeholder={ph ? `e.g. ${ph}` : undefined} value={m[id]} onChange={(e) => setM({ ...m, [id]: e.target.value })} />
    </div>
  );

  return (
    <div>
      <section className="border-b border-slate-200 bg-gradient-to-b from-teal-50 to-slate-50">
        <div className="mx-auto max-w-3xl px-4 py-10 text-center sm:py-16">
          <ElectionChip />
          <h1 className="mt-5 text-3xl font-bold tracking-tight text-slate-900 sm:text-5xl">Know every name on your ballot.</h1>
          <p className="mx-auto mt-4 max-w-xl text-lg text-slate-700">
            Find every race you can vote in on Nov 3, 2026, and get neutral, cited research on every candidate, from president to school board.
          </p>

          <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm sm:p-6">
            <div role="tablist" aria-label="How to find your ballot" className="mb-4 flex flex-wrap gap-1 rounded-lg bg-slate-100 p-1">
              {MODES.map((t) => (
                <button
                  key={t.id}
                  role="tab"
                  id={`tab-${t.id}`}
                  aria-selected={mode === t.id}
                  aria-controls={`panel-${t.id}`}
                  onClick={() => {
                    setMode(t.id);
                    setErr("");
                  }}
                  className={`flex-1 rounded-md px-3 py-2 text-sm font-medium ${
                    mode === t.id ? "bg-white text-teal-900 shadow-sm" : "text-slate-700 hover:bg-white/60"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {mode === "address" && (
              <form id="panel-address" role="tabpanel" aria-labelledby="tab-address" onSubmit={submitAddress} noValidate>
                <label htmlFor="address" className="mb-1 block text-sm font-medium text-slate-800">
                  Home address
                </label>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <input
                    id="address"
                    autoComplete="street-address"
                    className={inputCls}
                    placeholder="e.g. 1 University Ave, Gainesville, FL 32601"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                  />
                  <button type="submit" className="rounded-lg bg-teal-700 px-5 py-2.5 font-semibold text-white hover:bg-teal-800 sm:shrink-0">
                    Show my ballot
                  </button>
                </div>
                <p className="mt-2 text-xs text-slate-600">We use your address only to look up your districts. It is not stored.</p>
              </form>
            )}

            {mode === "map" && (
              <div id="panel-map" role="tabpanel" aria-labelledby="tab-map">
                <p className="mb-2 text-sm text-slate-700">Zoom in and click your home. Prefer the keyboard? Use the address or districts tabs.</p>
                <MapLazy showLegend={false} point={pick} onPick={(lat, lng) => setPick({ lat, lng })} className="h-72 sm:h-96" ariaLabel="Map: click your home location" />
                <div className="mt-3 flex items-center justify-between gap-3">
                  <p className="text-sm text-slate-700" aria-live="polite">
                    {pick ? `Selected ${pick.lat.toFixed(4)}, ${pick.lng.toFixed(4)}` : "No location selected yet."}
                  </p>
                  <button
                    disabled={!pick}
                    onClick={() => pick && go({ lat: pick.lat.toFixed(5), lng: pick.lng.toFixed(5) })}
                    className="rounded-lg bg-teal-700 px-5 py-2.5 font-semibold text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-600"
                  >
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
                  <button type="submit" className="rounded-lg bg-teal-700 px-5 py-2.5 font-semibold text-white hover:bg-teal-800">
                    Show my ballot
                  </button>
                  <button
                    type="button"
                    onClick={() => setM({ state: "FL", county: "Alachua", cd: "3", sd: "9", hd: "21", place: "Gainesville" })}
                    className="rounded-lg border border-slate-400 bg-white px-4 py-2.5 font-medium text-slate-800 hover:bg-slate-50"
                  >
                    Fill in Alachua County, FL
                  </button>
                </div>
              </form>
            )}

            {err && (
              <p role="alert" className="mt-3 text-sm font-medium text-amber-900">
                {err}
              </p>
            )}
          </div>
        </div>
      </section>

      <section aria-labelledby="how" className="mx-auto max-w-5xl px-4 py-12">
        <h2 id="how" className="text-center text-2xl font-bold text-slate-900">
          How BallotScout works
        </h2>
        <ol className="mt-8 grid gap-4 md:grid-cols-3">
          {[
            ["1", "Find your districts", "Your address maps to your congressional, state, county and local districts, drawn on a map."],
            ["2", "See your whole ballot", "Every race and ballot measure for your address, with a link to verify against your official sample ballot."],
            ["3", "Research any race", "Gemini Deep Research reads candidate sites, filings and news for several minutes, then writes a cited, neutral comparison."],
          ].map(([n, t, d]) => (
            <li key={n} className="rounded-xl border border-slate-200 bg-white p-5">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-teal-700 font-bold text-white" aria-hidden="true">
                {n}
              </span>
              <h3 className="mt-3 font-semibold text-slate-900">{t}</h3>
              <p className="mt-1 text-sm text-slate-700">{d}</p>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
