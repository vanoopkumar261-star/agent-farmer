"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useEffect, useState } from "react";
import { Circle, MapContainer, Marker, TileLayer, useMap } from "react-leaflet";
import { MapPin, Star, Navigation, Store as StoreIcon, Home } from "lucide-react";
import type { Store } from "@/lib/stores";

const houseIcon = L.divIcon({
  className: "",
  html: `<div style="width:32px;height:32px;border-radius:50%;background:#064E3B;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 12px rgba(6,78,59,.4);border:2px solid #fff"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg></div>`,
  iconSize: [32, 32],
  iconAnchor: [16, 16],
});

function storeIcon(active: boolean) {
  const bg = active ? "#10B981" : "#ffffff";
  const fg = active ? "#ffffff" : "#0F9D58";
  const size = active ? 30 : 26;
  return L.divIcon({
    className: "",
    html: `<div style="width:${size}px;height:${size}px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:${bg};border:2px solid #10B981;display:flex;align-items:center;justify-content:center;box-shadow:0 3px 8px rgba(16,24,20,.25)"><div style="transform:rotate(45deg);width:8px;height:8px;border-radius:50%;background:${fg}"></div></div>`,
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
  const [selected, setSelected] = useState<string | null>(stores[0]?.id ?? null);
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
            <h2 className="text-lg font-extrabold text-af-ink">Nearby Stores</h2>
          </div>
          <span className="font-mono text-[11px] font-bold text-af-muted">{stores.length} found</span>
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
                      <div className="text-sm font-bold text-af-ink truncate">{s.name}</div>
                      <div className="text-[11px] text-af-muted">{s.type}</div>
                    </div>
                    <span className="inline-flex items-center gap-0.5 rounded-full bg-af-amber/12 text-[#9a7100] px-2 py-0.5 text-[11px] font-bold shrink-0">
                      <Star className="w-3 h-3 fill-current" /> {s.rating}
                    </span>
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    <span className="inline-flex items-center gap-1 text-[12px] font-semibold text-af-ink-2">
                      <MapPin className="w-3.5 h-3.5 text-af-primary" /> {s.distanceKm} km away
                    </span>
                    <a
                      href={`https://www.google.com/maps/dir/?api=1&destination=${s.lat},${s.lng}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="inline-flex items-center gap-1 rounded-lg bg-af-primary/10 text-af-primary-deep px-2.5 py-1 text-[11px] font-bold hover:bg-af-primary/15 transition"
                    >
                      <Navigation className="w-3 h-3" /> Directions
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
        <div className="h-[420px] lg:h-[520px] w-full overflow-hidden rounded-[16px]">
          <MapContainer
            center={[house.lat, house.lng]}
            zoom={12}
            style={{ height: "100%", width: "100%" }}
            scrollWheelZoom
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <Recenter lat={center.lat} lng={center.lng} />
            <Circle
              center={[house.lat, house.lng]}
              radius={20000}
              pathOptions={{ color: "#10B981", weight: 1, fillColor: "#10B981", fillOpacity: 0.04 }}
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
            <Home className="w-3.5 h-3.5 text-af-secondary" /> Your farm
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-white border-2 border-af-primary" /> Store
          </span>
          <span className="ml-auto">20 km radius</span>
        </div>
      </div>
    </div>
  );
}
