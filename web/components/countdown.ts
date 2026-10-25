"use client";
import { useEffect, useState } from "react";

/** Polls open 7:00 AM ET on Tue Nov 3, 2026 (EST, UTC-5, since DST ends Nov 1). Use this everywhere. */
export const ELECTION_OPENS = new Date("2026-11-03T07:00:00-05:00");

export interface Countdown {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  /** true once the polls have opened */
  passed: boolean;
}

export function computeCountdown(now: number = Date.now()): Countdown {
  const ms = Math.max(0, ELECTION_OPENS.getTime() - now);
  const total = Math.floor(ms / 1000);
  return {
    days: Math.floor(total / 86400),
    hours: Math.floor((total % 86400) / 3600),
    minutes: Math.floor((total % 3600) / 60),
    seconds: total % 60,
    passed: ms === 0,
  };
}

/** Returns null on the server and first client render (avoids hydration mismatch), then ticks every second. */
export function useCountdown(): Countdown | null {
  const [c, setC] = useState<Countdown | null>(null);
  useEffect(() => {
    const tick = () => setC(computeCountdown());
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);
  return c;
}
