import { Chip, SectionLabel } from "./ui";
import type { DistrictBoundaries, VoterLocation } from "@/lib/types";

export function locationLabels(loc: VoterLocation) {
  return {
    county: loc.county ? `${loc.county} County` : "County",
    congressional: loc.congressionalDistrict ? `Congressional district ${loc.congressionalDistrict}` : "Congressional district",
    previousCongressional: loc.previousCongressionalDistrict ? `Old congressional district ${loc.previousCongressionalDistrict} (2024)` : "Old congressional district (2024)",
    stateSenate: loc.stateSenateDistrict ? `State senate district ${loc.stateSenateDistrict}` : "State senate district",
    stateHouse: loc.stateHouseDistrict ? `State house district ${loc.stateHouseDistrict}` : "State house district",
  };
}

export function LocationSummary({ loc }: { loc: VoterLocation }) {
  const bits: [string, string][] = (
    [
      loc.place && ["Place", loc.place],
      loc.county ? ["County", loc.county] : ["State", loc.state],
      loc.congressionalDistrict && ["CD", loc.congressionalDistrict],
      loc.stateSenateDistrict && ["SD", loc.stateSenateDistrict],
      loc.stateHouseDistrict && ["HD", loc.stateHouseDistrict],
    ] as ([string, string] | "" | undefined)[]
  ).filter(Boolean) as [string, string][];
  return (
    <ul className="flex flex-wrap gap-2" aria-label="Your districts">
      {bits.map(([k, v]) => (
        <li key={k}>
          <Chip>
            <span className="text-muted">{k}</span>
            <span className="text-accent">{v}</span>
          </Chip>
        </li>
      ))}
    </ul>
  );
}

type Box = [number, number, number, number];
function featureBox(f?: GeoJSON.Feature): Box | null {
  let w = 180, s = 90, e = -180, n = -90, any = false;
  const walk = (c: unknown) => {
    if (Array.isArray(c) && typeof c[0] === "number") {
      const [x, y] = c as number[];
      w = Math.min(w, x); e = Math.max(e, x); s = Math.min(s, y); n = Math.max(n, y);
      any = true;
    } else if (Array.isArray(c)) c.forEach(walk);
  };
  if (f?.geometry && "coordinates" in f.geometry) walk(f.geometry.coordinates);
  return any ? [w, s, e, n] : null;
}

/** True when two districts with the same number have visibly different extents. */
export function boundaryChanged(a?: GeoJSON.Feature, b?: GeoJSON.Feature): boolean {
  const x = featureBox(a), y = featureBox(b);
  if (!x || !y) return false;
  return x.some((v, i) => Math.abs(v - y[i]) > 0.01);
}

export function DistrictChangeNotice({ loc, boundaries }: { loc: VoterLocation; boundaries?: DistrictBoundaries }) {
  const cur = loc.congressionalDistrict;
  const prev = loc.previousCongressionalDistrict;
  if (!cur || !prev) return null;
  const name = (d: string) => (d === "AL" ? "At-large district" : `District ${d}`);
  if (cur !== prev)
    return (
      <div role="note" className="rounded-panel border-2 border-accent bg-panel p-4 shadow-dock sm:p-5">
        <SectionLabel tone="accent" className="mb-2">
          District changed
        </SectionLabel>
        <p className="font-sans text-[17px] font-bold leading-snug text-ink">
          Your congressional district changed:{" "}
          <span className="whitespace-nowrap font-mono text-accent">
            {name(prev)} &rarr; {name(cur)}
          </span>{" "}
          (new 2026 map)
        </p>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          This address was in {name(prev)} for the 2024 election. Several states redrew their congressional maps since then, so the candidates on your U.S. House ballot may be different. Turn on &ldquo;Old congressional district (2024)&rdquo; on the map to compare.
        </p>
      </div>
    );
  if (boundaryChanged(boundaries?.congressional, boundaries?.previousCongressional))
    return (
      <p role="note" className="rounded-panel border border-line-strong bg-panel p-3 text-sm text-muted">
        Your congressional district number didn&apos;t change, but its boundaries may have. Compare with the &ldquo;Old congressional district (2024)&rdquo; map layer.
      </p>
    );
  return null;
}
