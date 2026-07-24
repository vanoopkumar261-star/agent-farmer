"use client";

import dynamic from "next/dynamic";
import type { Store } from "@/lib/stores";

// Leaflet can't be server-rendered — load the map only on the client.
const StoreLocatorMap = dynamic(() => import("./StoreLocatorMap"), {
  ssr: false,
  loading: () => (
    <div className="h-[520px] rounded-2xl bg-af-card border border-af-border shadow-af-sm animate-pulse" />
  ),
});

export default function StoreLocatorClient(props: {
  house: { lat: number; lng: number; address?: string | null };
  stores: Store[];
}) {
  return <StoreLocatorMap {...props} />;
}
