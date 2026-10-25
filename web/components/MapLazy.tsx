"use client";
import dynamic from "next/dynamic";

export const MapLazy = dynamic(() => import("./MapView"), {
  ssr: false,
  loading: () => <div className="bs-skeleton h-full min-h-72 w-full" aria-hidden="true" />,
});
