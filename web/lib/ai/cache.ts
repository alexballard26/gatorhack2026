import fs from "fs/promises";
import path from "path";
import { DATA_DIR, isMock } from "./config";

/** JSON file cache under data/cache (data/cache/mock when MOCK_AI=1 so canned data never pollutes real cache). */
const root = () => path.join(DATA_DIR, "cache", isMock() ? "mock" : "");

export const slug = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120) || "x";

function file(ns: string, key: string) {
  return path.join(root(), ns, `${slug(key)}.json`);
}

export async function cacheGet<T>(ns: string, key: string): Promise<T | null> {
  try {
    return JSON.parse(await fs.readFile(file(ns, key), "utf8")) as T;
  } catch {
    return null;
  }
}

export async function cacheSet<T>(ns: string, key: string, value: T): Promise<void> {
  const f = file(ns, key);
  await fs.mkdir(path.dirname(f), { recursive: true });
  const tmp = `${f}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(value, null, 2));
  await fs.rename(tmp, f);
}

/** In-process de-duplication of concurrent identical generations. */
const inflight = new Map<string, Promise<unknown>>();
export function once<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const existing = inflight.get(key);
  if (existing) return existing as Promise<T>;
  const p = fn().finally(() => inflight.delete(key));
  inflight.set(key, p);
  return p;
}
