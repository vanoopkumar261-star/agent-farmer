"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useEffect, useMemo, useState } from "react";
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from "react-leaflet";
import { Search, MapPin } from "lucide-react";

export type SelectedLocation = {
  lat: number;
  lng: number;
  address?: string;
};

type Props = {
  value?: SelectedLocation;
  onChange: (loc: SelectedLocation) => void;
};

const markerIcon = new L.Icon({
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

function RecenterMap({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView([lat, lng], Math.max(map.getZoom(), 12), { animate: true });
  }, [lat, lng, map]);
  return null;
}

function ClickToSetMarker({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onPick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

async function reverseGeocode(lat: number, lng: number) {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`;
    const res = await fetch(url, { headers: { "Accept": "application/json" } });
    const data = await res.json();
    return (data?.display_name as string) || undefined;
  } catch {
    return undefined;
  }
}

async function geocode(query: string) {
  const q = query.trim();
  if (!q) return null;

  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
    q
  )}&limit=1`;
  const res = await fetch(url, { headers: { "Accept": "application/json" } });
  const data = await res.json();

  if (!Array.isArray(data) || data.length === 0) return null;

  const first = data[0];
  return {
    lat: parseFloat(first.lat),
    lng: parseFloat(first.lon),
    address: first.display_name as string,
  } as SelectedLocation;
}

export default function MapSelector({ value, onChange }: Props) {
  const initial = useMemo<SelectedLocation>(() => {
    return value ?? { lat: 20.5937, lng: 78.9629 }; // India center default
  }, [value]);

  const [pos, setPos] = useState<SelectedLocation>(initial);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [hint, setHint] = useState<string | undefined>(value?.address);

  useEffect(() => {
    // Attempt device location once
    if (value) return;
    if (!navigator.geolocation) return;

    navigator.geolocation.getCurrentPosition(
      async (p) => {
        const lat = p.coords.latitude;
        const lng = p.coords.longitude;
        const address = await reverseGeocode(lat, lng);
        const next = { lat, lng, address };
        setPos(next);
        setHint(address);
        onChange(next);
      },
      () => {
        // ignore if denied
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pick = async (lat: number, lng: number) => {
    setBusy(true);
    const address = await reverseGeocode(lat, lng);
    const next = { lat, lng, address };
    setPos(next);
    setHint(address);
    onChange(next);
    setBusy(false);
  };

  const handleSearch = async () => {
    setBusy(true);
    const result = await geocode(query);
    if (result) {
      setPos(result);
      setHint(result.address);
      onChange(result);
    }
    setBusy(false);
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-[#0b1c30]/40 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search address / village / pincode..."
            className="w-full rounded-[14px] bg-[#eff4ff] border border-white/70 pl-10 pr-4 py-3 text-sm text-[#0b1c30] outline-none focus:ring-2 focus:ring-[#93eabe]/60"
          />
        </div>
        <button
          onClick={handleSearch}
          disabled={busy}
          className="rounded-[14px] bg-white/70 hover:bg-white/80 backdrop-blur border border-white/70 px-4 text-sm font-bold text-[#0b1c30] transition disabled:opacity-60"
        >
          {busy ? "..." : "Locate"}
        </button>
      </div>

      {hint && (
        <div className="flex items-start gap-2 rounded-[16px] bg-white/70 backdrop-blur border border-white/70 px-4 py-3">
          <MapPin className="w-4 h-4 text-[#005136] mt-0.5" />
          <div className="text-sm text-[#0b1c30]/70 leading-relaxed">
            <span className="font-semibold text-[#0b1c30]">Selected:</span>{" "}
            {hint}
          </div>
        </div>
      )}

      <div className="h-[320px] w-full overflow-hidden rounded-[24px] bg-white/70 backdrop-blur border border-white/70 shadow-[0_18px_60px_rgba(0,0,0,0.06)]">
        <MapContainer
          center={[pos.lat, pos.lng]}
          zoom={5}
          style={{ height: "100%", width: "100%" }}
          scrollWheelZoom={true}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          <ClickToSetMarker onPick={pick} />
          <RecenterMap lat={pos.lat} lng={pos.lng} />

          <Marker position={[pos.lat, pos.lng]} icon={markerIcon} />
        </MapContainer>
      </div>

      <p className="text-xs text-[#0b1c30]/55">
        Tip: zoom in and click on the map to pin your house location.
      </p>
    </div>
  );
}