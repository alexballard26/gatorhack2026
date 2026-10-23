import type {
  AskResponse,
  BallotResponse,
  CandidateProfile,
  DistrictsResponse,
  ResearchJob,
  VoterLocation,
} from "./types";
import * as fx from "./fixtures";

export const USE_FIXTURES = process.env.NEXT_PUBLIC_USE_FIXTURES === "1";

/** What the user told us about where they live. Mirrors the URL search params. */
export interface LocationQuery {
  address?: string;
  lat?: string;
  lng?: string;
  state?: string;
  county?: string;
  cd?: string;
  sd?: string;
  hd?: string;
  place?: string;
}

const KEYS: (keyof LocationQuery)[] = ["address", "lat", "lng", "state", "county", "cd", "sd", "hd", "place"];

export function parseQuery(sp: { get(name: string): string | null }): LocationQuery {
  const q: LocationQuery = {};
  for (const k of KEYS) {
    const v = sp.get(k);
    if (v && v.trim()) q[k] = v.trim();
  }
  return q;
}

export function queryToString(q: LocationQuery): string {
  const p = new URLSearchParams();
  for (const k of KEYS) if (q[k]) p.set(k, q[k] as string);
  return p.toString();
}

export function hasLocation(q: LocationQuery): boolean {
  return Boolean(q.address || (q.lat && q.lng) || q.state);
}

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, init);
  } catch {
    throw new ApiError("Could not reach the server. Check your connection and try again.", 0);
  }
  if (!res.ok) {
    let msg = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      if (body && typeof body.error === "string") msg = body.error;
    } catch {
      /* ignore */
    }
    throw new ApiError(msg, res.status);
  }
  return (await res.json()) as T;
}

export function getDistricts(q: LocationQuery): Promise<DistrictsResponse> {
  if (USE_FIXTURES) return fx.districts(q);
  const p = new URLSearchParams();
  if (q.address) p.set("address", q.address);
  else if (q.lat && q.lng) {
    p.set("lat", q.lat);
    p.set("lng", q.lng);
  } else {
    if (q.state) p.set("state", q.state);
    if (q.county) p.set("county", q.county);
    if (q.cd) p.set("cd", q.cd);
    if (q.sd) p.set("sd", q.sd);
    if (q.hd) p.set("hd", q.hd);
  }
  return request(`/api/districts?${p}`);
}

export function getBallot(loc: VoterLocation): Promise<BallotResponse> {
  if (USE_FIXTURES) return fx.ballot(loc);
  const p = new URLSearchParams({ state: loc.state });
  if (loc.county) p.set("county", loc.county);
  if (loc.congressionalDistrict) p.set("cd", loc.congressionalDistrict);
  if (loc.stateSenateDistrict) p.set("sd", loc.stateSenateDistrict);
  if (loc.stateHouseDistrict) p.set("hd", loc.stateHouseDistrict);
  if (loc.place) p.set("place", loc.place);
  return request(`/api/ballot?${p}`);
}

export function getCandidate(raceId: string, candidateId: string): Promise<CandidateProfile> {
  if (USE_FIXTURES) return fx.candidate(raceId, candidateId);
  const p = new URLSearchParams({ raceId, candidateId });
  return request(`/api/candidate?${p}`);
}

export function startResearch(raceId: string): Promise<ResearchJob> {
  if (USE_FIXTURES) return fx.startResearch(raceId);
  return request("/api/research", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ raceId }),
  });
}

export function getResearch(raceId: string): Promise<ResearchJob> {
  if (USE_FIXTURES) return fx.pollResearch(raceId);
  return request(`/api/research?${new URLSearchParams({ raceId })}`);
}

export function askRace(input: { raceId: string; candidateId?: string; question: string }): Promise<AskResponse> {
  if (USE_FIXTURES) return fx.ask(input);
  return request("/api/ask", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}
