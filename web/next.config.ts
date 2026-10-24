import type { NextConfig } from "next";
import path from "path";
import { loadEnvConfig } from "@next/env";

// Load the repo-root .env (GEMINI_API_KEY etc.) in addition to web/.env*.
// Server-side only: none of these are exposed to the client (no NEXT_PUBLIC_ prefix).
// forceReload: Next has already loaded (and cached) web/'s env by now, so a plain call is a no-op.
loadEnvConfig(path.resolve(process.cwd(), ".."), process.env.NODE_ENV !== "production", undefined, true);

const nextConfig: NextConfig = {
  // Extra dev servers (e.g. agents testing on other ports) must set NEXT_DIST_DIR to their own folder:
  // two servers sharing .next corrupt each other's chunks and the page stops hydrating.
  distDir: process.env.NEXT_DIST_DIR || ".next",
};

export default nextConfig;
