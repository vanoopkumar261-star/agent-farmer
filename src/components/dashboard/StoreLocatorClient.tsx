"use client";

import dynamic from "next/dynamic";
import { MapPinOff, ExternalLink } from "lucide-react";
import type { Store } from "@/lib/stores";
import { SEARCH_RADIUS_KM } from "@/lib/storeConfig";
import { useT } from "@/components/i18n/LanguageProvider";

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
  const { t } = useT();

  /**
   * Nothing verifiable within 100 km.
   *
   * This screen used to fill that silence with six invented shops on a circle
   * around the farmer's house, which is why Directions opened Google Maps in an
   * empty field. An empty answer is the honest one, and it is not a dead end:
   * the button hands the farmer Google's own live search for their area, which
   * needs no API key and cannot point at a place that does not exist.
   */
  if (props.stores.length === 0) {
    const { lat, lng } = props.house;
    const search =
      "https://www.google.com/maps/search/?api=1&query=" +
      encodeURIComponent("agricultural supplies fertilizer seeds") +
      `&center=${lat},${lng}`;

    return (
      <div className="max-w-lg mx-auto mt-10 rounded-2xl bg-af-card border border-af-border shadow-af-sm p-8 text-center">
        <div className="w-12 h-12 rounded-2xl bg-af-sage mx-auto flex items-center justify-center">
          <MapPinOff className="w-6 h-6 text-af-secondary" />
        </div>
        <h2 className="mt-4 text-[18px] font-semibold tracking-[-0.02em] text-af-ink">
          {t("stores.emptyTitle", { n: SEARCH_RADIUS_KM })}
        </h2>
        <p className="mt-2 text-sm text-af-ink-2 leading-relaxed">
          {t("stores.emptyBody")}
        </p>
        <a
          href={search}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-6 inline-flex items-center gap-2 rounded-[14px] bg-af-primary text-white px-5 py-3 text-sm font-semibold hover:bg-af-primary-deep transition"
        >
          {t("stores.searchOnMaps")}
          <ExternalLink className="w-4 h-4" />
        </a>
      </div>
    );
  }

  return <StoreLocatorMap {...props} />;
}
