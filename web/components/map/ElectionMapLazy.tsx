"use client";
import dynamic from "next/dynamic";

/** Client-only, code-split: the home page paints first, the map chunk (d3-geo + state shapes) follows. */
export const ElectionMapLazy = dynamic(() => import("./ElectionMap"), {
  ssr: false,
  loading: () => <div className="h-full min-h-72 w-full border border-line bg-[#070c0b]" aria-hidden="true" />,
});
