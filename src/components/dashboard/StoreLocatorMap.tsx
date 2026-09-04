"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useEffect, useState } from "react";
import { Circle, MapContainer, Marker, TileLayer, useMap } from "react-leaflet";
import { MapPin, Navigation, Store as StoreIcon, Home, Layers } from "lucide-react";
import type { Store } from "@/lib/stores";
import { directionsUrl } from "@/lib/storeDirections";
import { SEARCH_RADIUS_KM } from "@/lib/storeConfig";
import { useT } from "@/components/i18n/LanguageProvider";

const houseIcon = L.divIcon({
  className: "",
  html: `<div style="width:32px;height:32px;border-radius:50%;background:#173B2A;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 12px rgba(23,59,42,.35);border:2px solid #fff"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg></div>`,
  iconSize: [32, 32],
  iconAnchor: [16, 16],
});

function storeIcon(active: boolean) {
  const bg = active ? "#284D35" : "#ffffff";
  const fg = active ? "#ffffff" : "#284D35";
  const size = active ? 30 : 26;
  return L.divIcon({
    className: "",
    html: `<div style="width:${size}px;height:${size}px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:${bg};border:2px solid #284D35;display:flex;align-items:center;justify-content:center;box-shadow:0 3px 8px rgba(23,59,42,.25)"><div style="transform:rotate(45deg);width:8px;height:8px;border-radius:50%;background:${fg}"></div></div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size],
  });
}

function Recenter({ lat, lng, zoom }: { lat: number; lng: number; zoom?: number }) {
  const map = useMap();
  useEffect(() => {
    map.flyTo([lat, lng], zoom ?? map.getZoom(), { duration: 0.6 });
  }, [lat, lng, zoom, map]);
  return null;
}

export default function StoreLocatorMap({
  house,
  stores,
}: {
  house: { lat: number; lng: number; address?: string | null };
  stores: Store[];
}) {
  const { t } = useT();
  const [selected, setSelected] = useState<string | null>(stores[0]?.id ?? null);
  const [satellite, setSatellite] = useState(false);
  const active = stores.find((s) => s.id === selected);
  const center = active ?? house;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.4fr] gap-6">
      {/* List */}
      <div className="rounded-2xl bg-af-card border border-af-border shadow-af-sm p-5 order-2 lg:order-1">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2.5">
            <span className="flex items-center justify-center w-8 h-8 rounded-xl bg-af-sage text-af-secondary">
              <StoreIcon className="w-4 h-4" />
            </span>
            <h2 className="text-[17px] font-semibold tracking-[-0.02em] text-af-ink">{t("storeLocatorMap.nearbyStores")}</h2>
          </div>
          <span className="font-mono text-[11px] font-semibold text-af-muted">{t("storeLocatorMap.found", { n: stores.length })}</span>
        </div>

        <ul className="space-y-2 max-h-[460px] overflow-auto -mr-1 pr-1">
          {stores.map((s) => {
            const isActive = s.id === selected;
            return (
              <li key={s.id}>
                <button
                  onClick={() => setSelected(s.id)}
                  className={`af-spotlight relative w-full text-left rounded-[14px] border p-3.5 transition-all ${
                    isActive
                      ? "border-af-primary/50 bg-af-primary/[0.04] ring-2 ring-af-primary/15"
                      : "border-af-border bg-af-card hover:border-af-primary/30"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-af-ink truncate">{s.name}</div>
                      <div className="text-[11px] text-af-muted">{t(s.labelKey)}</div>
                    </div>
                  </div>
                  {/* The star rating that used to sit here was `ratingFor()` —
                      the shop's own name hashed into a number between 3.8 and
                      4.9, shown as if it were a review score.

                      The address replaces it, and it is doing real work rather
                      than filling the gap. Community-mapped shops are not in
                      Google's index, so their pin borrows the name of whatever
                      business Google does have nearby — a garden centre opens a
                      page titled "unisex salon". The address is how a farmer
                      confirms the destination is the right street before
                      setting off, so it gets its own full-width line instead of
                      being truncated into the corner. */}
                  {s.address && (
                    <div className="mt-1.5 flex items-start gap-1.5 text-[11px] text-af-muted leading-snug">
                      <MapPin className="w-3 h-3 mt-[1px] shrink-0 text-af-muted/70" />
                      <span className="min-w-0">{s.address}</span>
                    </div>
                  )}
                  <div className="mt-2 flex items-center justify-between">
                    <span className="inline-flex items-center gap-1 text-[12px] font-semibold text-af-ink-2">
                      <MapPin className="w-3.5 h-3.5 text-af-primary" /> {t("storeLocatorMap.kmAway", { n: s.distanceKm })}
                    </span>
                    <a
                      href={directionsUrl(s)}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="inline-flex items-center gap-1 rounded-lg bg-af-primary/10 text-af-primary-deep px-2.5 py-1 text-[11px] font-semibold hover:bg-af-primary/15 transition"
                    >
                      <Navigation className="w-3 h-3" /> {t("storeLocatorMap.directions")}
                    </a>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      {/* Map */}
      <div className="rounded-2xl bg-af-card border border-af-border shadow-af-sm p-2.5 order-1 lg:order-2">
        <div className="relative h-[420px] lg:h-[520px] w-full overflow-hidden rounded-[16px]">
          {/* Satellite is the useful half of what people mean by "Google Earth":
              on imagery a farmer can see whether a pin sits on a real building
              or in a field. Esri World Imagery is free and needs no key.

              z-[1000] is not arbitrary: Leaflet gives its overlayPane z-index
              400, so a button at 400 ties with the circle's SVG and loses the
              hit test to it on DOM order — visible, but dead to a click.
              Leaflet's own controls sit at 800-1000, so this clears them all. */}
          <button
            onClick={() => setSatellite((v) => !v)}
            aria-pressed={satellite}
            className="absolute top-3 right-3 z-[1000] inline-flex items-center gap-1.5 rounded-[10px] border border-af-border bg-af-card/95 backdrop-blur px-2.5 py-1.5 text-[11px] font-semibold text-af-ink shadow-af-sm hover:border-af-primary/40 transition"
          >
            <Layers className="w-3.5 h-3.5 text-af-primary" />
            {satellite ? t("storeLocatorMap.viewMap") : t("storeLocatorMap.viewSatellite")}
          </button>

          <MapContainer
            center={[house.lat, house.lng]}
            zoom={8}
            style={{ height: "100%", width: "100%" }}
            scrollWheelZoom
          >
            {satellite ? (
              <TileLayer
                key="sat"
                attribution='Imagery &copy; <a href="https://www.esri.com/">Esri</a>, Maxar, Earthstar Geographics'
                url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                maxZoom={19}
              />
            ) : (
              <TileLayer
                key="map"
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
            )}
            <Recenter lat={center.lat} lng={center.lng} />
            <Circle
              center={[house.lat, house.lng]}
              radius={SEARCH_RADIUS_KM * 1000}
              pathOptions={{
                color: satellite ? "#F7F6F0" : "#668653",
                weight: 1,
                fillColor: "#668653",
                fillOpacity: satellite ? 0 : 0.04,
              }}
            />
            <Marker position={[house.lat, house.lng]} icon={houseIcon} />
            {stores.map((s) => (
              <Marker
                key={s.id}
                position={[s.lat, s.lng]}
                icon={storeIcon(s.id === selected)}
                eventHandlers={{ click: () => setSelected(s.id) }}
              />
            ))}
          </MapContainer>
        </div>
        <div className="flex items-center gap-4 px-2 py-2 text-[11px] text-af-muted">
          <span className="inline-flex items-center gap-1.5">
            <Home className="w-3.5 h-3.5 text-af-secondary" /> {t("storeLocatorMap.yourFarm")}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-white border-2 border-af-primary" /> {t("storeLocatorMap.store")}
          </span>
          <span className="ml-auto">{t("storeLocatorMap.radius", { n: SEARCH_RADIUS_KM })}</span>
        </div>
      </div>
    </div>
  );
}
