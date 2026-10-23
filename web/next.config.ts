import type { NextConfig } from "next";
import path from "path";
import { loadEnvConfig } from "@next/env";

// Load the repo-root .env (GEMINI_API_KEY etc.) in addition to web/.env*.
// Server-side only: none of these are exposed to the client (no NEXT_PUBLIC_ prefix).
loadEnvConfig(path.resolve(process.cwd(), ".."));

const nextConfig: NextConfig = {
  /* config options here */
};

export default nextConfig;
