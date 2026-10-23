"use client";
import { useCallback, useEffect, useState } from "react";
import { getBallot, getDistricts, hasLocation, queryToString, type LocationQuery } from "@/lib/api";
import type { BallotResponse, DistrictBoundaries, VoterLocation } from "@/lib/types";

export interface BallotData {
  status: "empty" | "loading" | "ready" | "error";
  stage?: string;
  error?: string;
  location?: VoterLocation;
  boundaries?: DistrictBoundaries;
  ballot?: BallotResponse;
  retry: () => void;
}

interface Cached {
  location: VoterLocation;
  boundaries?: DistrictBoundaries;
  ballot: BallotResponse;
}
const cache = new Map<string, Cached>();

export function useBallotData(q: LocationQuery): BallotData {
  const key = queryToString(q);
  const [state, setState] = useState<Omit<BallotData, "retry">>({ status: hasLocation(q) ? "loading" : "empty" });
  const [attempt, setAttempt] = useState(0);
  const retry = useCallback(() => setAttempt((a) => a + 1), []);

  useEffect(() => {
    const query: LocationQuery = Object.fromEntries(new URLSearchParams(key)) as LocationQuery;
    if (!hasLocation(query)) {
      setState({ status: "empty" });
      return;
    }
    const hit = cache.get(key);
    if (hit && attempt === 0) {
      setState({ status: "ready", ...hit });
      return;
    }
    let cancelled = false;
    setState({ status: "loading", stage: "Finding your districts…" });
    (async () => {
      try {
        const geocoded = Boolean(query.address || (query.lat && query.lng));
        let location: VoterLocation;
        let boundaries: DistrictBoundaries | undefined;
        if (geocoded) {
          const d = await getDistricts(query);
          location = d.location;
          boundaries = d.boundaries;
        } else {
          location = {
            state: (query.state ?? "").toUpperCase(),
            county: query.county,
            congressionalDistrict: query.cd,
            stateSenateDistrict: query.sd,
            stateHouseDistrict: query.hd,
            place: query.place,
            method: "manual",
          };
          // Boundaries are a nice-to-have for manual entry: load them without blocking the ballot.
          getDistricts(query)
            .then((d) => {
              if (cancelled) return;
              boundaries = d.boundaries;
              setState((s) => (s.status === "ready" ? { ...s, boundaries: d.boundaries } : s));
              const c = cache.get(key);
              if (c) cache.set(key, { ...c, boundaries: d.boundaries });
            })
            .catch(() => {});
        }
        if (cancelled) return;
        setState({ status: "loading", stage: "Compiling your ballot… the first lookup for a new area can take up to 30 seconds.", location, boundaries });
        const ballot = await getBallot(location);
        if (cancelled) return;
        cache.set(key, { location, boundaries, ballot });
        setState({ status: "ready", location, boundaries, ballot });
      } catch (e) {
        if (!cancelled) setState({ status: "error", error: e instanceof Error ? e.message : "Unknown error" });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [key, attempt]);

  return { ...state, retry };
}
