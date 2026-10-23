import type { VoterLocation } from "@/lib/types";

export function locationLabels(loc: VoterLocation) {
  return {
    county: loc.county ? `${loc.county} County` : "County",
    congressional: loc.congressionalDistrict ? `Congressional district ${loc.congressionalDistrict}` : "Congressional district",
    stateSenate: loc.stateSenateDistrict ? `State senate district ${loc.stateSenateDistrict}` : "State senate district",
    stateHouse: loc.stateHouseDistrict ? `State house district ${loc.stateHouseDistrict}` : "State house district",
  };
}

export function LocationSummary({ loc }: { loc: VoterLocation }) {
  const bits = [
    loc.place,
    loc.county ? `${loc.county} County, ${loc.state}` : loc.state,
    loc.congressionalDistrict && `CD ${loc.congressionalDistrict}`,
    loc.stateSenateDistrict && `SD ${loc.stateSenateDistrict}`,
    loc.stateHouseDistrict && `HD ${loc.stateHouseDistrict}`,
  ].filter(Boolean) as string[];
  return (
    <ul className="flex flex-wrap gap-2" aria-label="Your districts">
      {bits.map((b) => (
        <li key={b} className="rounded-full border border-slate-300 bg-white px-3 py-1 text-sm text-slate-800">
          {b}
        </li>
      ))}
    </ul>
  );
}
