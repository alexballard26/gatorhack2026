import fs from "fs/promises";
import path from "path";
import type { SpendLedger } from "../types";
import { BudgetError, DATA_DIR, budgetUsd, maxDeepResearchRuns } from "./config";

const LEDGER = path.join(DATA_DIR, "spend.json");
let lock: Promise<unknown> = Promise.resolve();
/** Serialize ledger read-modify-write within this process. */
function locked<T>(fn: () => Promise<T>): Promise<T> {
  const run = lock.then(fn, fn);
  lock = run.catch(() => undefined);
  return run;
}

export const FLASH_IN_PER_M = 0.75;
export const FLASH_OUT_PER_M = 3.75;
export const GROUNDING_PER_REQUEST = 0.014;
export const DEEP_RESEARCH_ESTIMATE = 3;

async function read(): Promise<SpendLedger> {
  let l: SpendLedger;
  try {
    l = JSON.parse(await fs.readFile(LEDGER, "utf8"));
  } catch {
    l = { budgetUsd: budgetUsd(), spentUsd: 0, entries: [] };
  }
  l.budgetUsd = budgetUsd(); // env always wins
  return l;
}
async function write(l: SpendLedger) {
  l.spentUsd = Math.round(l.entries.reduce((a, e) => a + e.usd, 0) * 10000) / 10000;
  await fs.mkdir(path.dirname(LEDGER), { recursive: true });
  const tmp = `${LEDGER}.${process.pid}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(l, null, 2));
  await fs.rename(tmp, LEDGER);
}

export const getLedger = () => locked(read);

/** Throws BudgetError (HTTP 402) if `estimateUsd` would exceed the budget. Call before every paid call. */
export function assertBudget(estimateUsd: number): Promise<void> {
  return locked(async () => {
    const l = await read();
    if (l.spentUsd + estimateUsd > l.budgetUsd) {
      throw new BudgetError(
        `Budget guard: spent $${l.spentUsd.toFixed(2)} of $${l.budgetUsd.toFixed(2)}; this call needs ~$${estimateUsd.toFixed(2)}. Raise BUDGET_USD to continue.`,
      );
    }
  });
}

export function record(kind: SpendLedger["entries"][number]["kind"], usd: number, note: string): Promise<void> {
  return locked(async () => {
    const l = await read();
    l.entries.push({ at: new Date().toISOString(), kind, usd: Math.round(usd * 1e6) / 1e6, note });
    await write(l);
  });
}

export function flashCost(inputTokens = 0, outputTokens = 0) {
  return (inputTokens / 1e6) * FLASH_IN_PER_M + (outputTokens / 1e6) * FLASH_OUT_PER_M;
}

/**
 * Atomically check budget + run cap and reserve a Deep Research run ($3 conservative estimate).
 * Throws BudgetError if either limit would be exceeded.
 */
export function reserveDeepResearch(note: string): Promise<void> {
  return locked(async () => {
    const l = await read();
    const runs =
      l.entries.filter((e) => e.kind === "deep-research" && e.usd > 0).length -
      l.entries.filter((e) => e.kind === "deep-research" && e.usd < 0).length;
    if (runs >= maxDeepResearchRuns()) {
      throw new BudgetError(`Deep Research run cap reached (${runs}/${maxDeepResearchRuns()}). Raise MAX_DEEP_RESEARCH_RUNS to continue.`);
    }
    if (l.spentUsd + DEEP_RESEARCH_ESTIMATE > l.budgetUsd) {
      throw new BudgetError(
        `Budget guard: spent $${l.spentUsd.toFixed(2)} of $${l.budgetUsd.toFixed(2)}; a Deep Research run is estimated at $${DEEP_RESEARCH_ESTIMATE}.`,
      );
    }
    l.entries.push({ at: new Date().toISOString(), kind: "deep-research", usd: DEEP_RESEARCH_ESTIMATE, note });
    await write(l);
  });
}

/** Refund a reservation when the run provably never started (API rejected the create call). */
export function refundDeepResearch(note: string): Promise<void> {
  return locked(async () => {
    const l = await read();
    l.entries.push({ at: new Date().toISOString(), kind: "deep-research", usd: -DEEP_RESEARCH_ESTIMATE, note: `refund: ${note}` });
    await write(l);
  });
}
