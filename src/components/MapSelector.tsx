"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from "react-leaflet";
import { Search, MapPin, LocateFixed, Loader2, AlertTriangle } from "lucide-react";

export type SelectedLocation = {
  lat: number;
  lng: number;
  address?: string;
  /** Postal (PIN) code, when the geocoder can resolve one. */
  pincode?: string;
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

/** House-level zoom used after a locate / place search. */
const HOUSE_ZOOM = 16;
/** Area-level zoom after a PIN-code search — the farmer then refines by hand. */
const PIN_ZOOM = 14;

/**
 * `nonce` exists so a *repeat* recenter still moves the map. MapCamera drives
 * the view from an effect keyed on its props, so re-locating (or re-searching)
 * the same point after the farmer had panned away produced an identical
 * lat/lng/zoom, the effect never re-ran, and the button silently did nothing.
 * Every deliberate recenter bumps this instead.
 */
type CameraTarget = { lat: number; lng: number; zoom: number; nonce: number };

/**
 * Drives the map camera. Only "Use my current location" and a search move it —
 * a map click or marker drag deliberately leaves the view where it is so it
 * doesn't jump under the farmer's finger.
 */
function MapCamera({ lat, lng, zoom, nonce }: CameraTarget) {
  const map = useMap();
  useEffect(() => {
    // setView, not flyTo: Leaflet animates a short hop and jumps instantly for a
    // long one (e.g. a farmer correcting a PIN in a different state), which a
    // fixed-duration flyTo parabola does not.
    map.setView([lat, lng], zoom, { animate: true });
  }, [lat, lng, zoom, nonce, map]);
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

type GeoResult = { address?: string; pincode?: string };

/**
 * Geocoding goes through our own `/api/geocode` proxy, not straight to
 * Nominatim: the app CSP is `connect-src 'self'`, and the proxy also sends a
 * compliant User-Agent and caches results.
 */
async function reverseGeocode(lat: number, lng: number): Promise<GeoResult> {
  try {
    const res = await fetch(`/api/geocode?lat=${lat}&lng=${lng}`);
    if (!res.ok) return {};
    const data = await res.json();
    return { address: data?.address || undefined, pincode: data?.pincode || undefined };
  } catch {
    return {};
  }
}

async function geocode(query: string): Promise<SelectedLocation | null> {
  const q = query.trim();
  if (!q) return null;
  try {
    const res = await fetch(`/api/geocode?q=${encodeURIComponent(q)}`);
    if (!res.ok) return null;
    const data = await res.json();
    if (typeof data?.lat !== "number" || typeof data?.lng !== "number") return null;
    return {
      lat: data.lat,
      lng: data.lng,
      address: data.address || undefined,
      pincode: data.pincode || undefined,
    };
  } catch {
    return null;
  }
}

export default function MapSelector({ value, onChange }: Props) {
  const initial = useMemo<SelectedLocation>(() => {
    return value ?? { lat: 20.5937, lng: 78.9629 }; // India center default
  }, [value]);

  const [pos, setPos] = useState<SelectedLocation>(initial);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false); // search in flight
  const [locating, setLocating] = useState(false); // geolocation in flight
  const [hint, setHint] = useState<string | undefined>(value?.address);
  const [selected, setSelected] = useState(Boolean(value?.lat && value?.lng));
  const [geoError, setGeoError] = useState<string | undefined>(undefined);

  const [camera, setCamera] = useState<CameraTarget>({
    lat: initial.lat,
    lng: initial.lng,
    zoom: value ? HOUSE_ZOOM : 5,
    nonce: 0,
  });

  const markerRef = useRef<L.Marker>(null);
  /**
   * Stable tuple for the marker: react-leaflet calls `marker.setLatLng` whenever
   * this prop's identity changes, so a fresh `[lat, lng]` literal each render
   * would re-place the pin on every unrelated re-render — including mid-drag,
   * which yanks it back out from under the farmer's finger.
   */
  const markerPos = useMemo<[number, number]>(() => [pos.lat, pos.lng], [pos.lat, pos.lng]);
  /**
   * Monotonic id for the current selection. Reverse-geocoding is async, so a
   * quick second pick (drag, then tap elsewhere) could otherwise have the first
   * pick's slower address land last and overwrite the newer one.
   */
  const seqRef = useRef(0);

  /**
   * Commits a chosen point: moves the marker, records the coordinates, then
   * reverse-geocodes for a human-readable address. `onChange` fires immediately
   * with the coordinates so the form is never blocked waiting on the geocoder,
   * and again once the address resolves.
   *
   * `recenterZoom` is passed for "Use my current location" (there's no reason
   * not to fly there); a map click or marker drag omits it so the view stays
   * put under the farmer's finger.
   */
  const applyLocation = useCallback(
    (lat: number, lng: number, recenterZoom?: number) => {
      const seq = ++seqRef.current;
      setPos({ lat, lng });
      setSelected(true);
      setGeoError(undefined);
      setHint(undefined); // clear the previous address while the new one resolves
      if (recenterZoom != null) {
        setCamera((c) => ({ lat, lng, zoom: recenterZoom, nonce: c.nonce + 1 }));
      }
      onChange({ lat, lng });

      reverseGeocode(lat, lng).then((r) => {
        if (seqRef.current !== seq) return; // superseded by a newer pick
        setHint(r.address);
        onChange({ lat, lng, address: r.address, pincode: r.pincode });
      });
    },
    [onChange]
  );

  const handleLocate = useCallback(() => {
    if (locating) return;
    setGeoError(undefined);

    if (typeof window !== "undefined" && !window.isSecureContext) {
      setGeoError(
        "Location needs a secure (HTTPS) connection. Please select your farm location manually on the map."
      );
      return;
    }
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      setGeoError("This browser can't detect your location. Please select it manually on the map.");
      return;
    }

    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setLocating(false);
        applyLocation(p.coords.latitude, p.coords.longitude, HOUSE_ZOOM);
      },
      (err) => {
        setLocating(false);
        if (err.code === err.PERMISSION_DENIED) {
          setGeoError(
            "Location permission was denied. Please enable location access or select your farm location manually on the map."
          );
        } else if (err.code === err.TIMEOUT) {
          setGeoError(
            "Location detection timed out. Please try again or select the location manually."
          );
        } else {
          setGeoError("Unable to detect your location. Please select it manually on the map.");
        }
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  }, [locating, applyLocation]);

  const handleSearch = useCallback(async () => {
    const q = query.trim();
    if (busy) return;
    if (!q) {
      // Silence here is what the old build did on an empty box, and it read as
      // a dead button. Say what the field wants instead.
      setGeoError(
        "Type a village, area or 6-digit PIN code to search — or use “Use my current location”."
      );
      return;
    }

    setBusy(true);
    setGeoError(undefined);
    const seq = ++seqRef.current;
    const result = await geocode(q);
    if (seqRef.current !== seq) {
      setBusy(false);
      return; // the farmer picked something else while this was in flight
    }
    if (result) {
      setHint(result.address);
      setPos({ lat: result.lat, lng: result.lng });
      setSelected(true);
      setCamera((c) => ({
        lat: result.lat,
        lng: result.lng,
        zoom: /^\d{6}$/.test(q) ? PIN_ZOOM : HOUSE_ZOOM - 1,
        nonce: c.nonce + 1,
      }));
      onChange(result);
    } else {
      setGeoError(
        `Couldn't find "${q}". Try a nearby area name or 6-digit PIN code, or pick the spot on the map.`
      );
    }
    setBusy(false);
  }, [query, busy, onChange]);

  const handleMarkerDragEnd = useCallback((e: L.LeafletEvent) => {
    // Read the pin off the event target rather than the ref: the ref is only a
    // fallback, and the event always carries the marker that actually moved.
    const m = (e?.target as L.Marker) ?? markerRef.current;
    if (!m) return;
    const { lat, lng } = m.getLatLng();
    // No recenter — the pin is already exactly where the farmer dropped it.
    applyLocation(lat, lng);
  }, [applyLocation]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="w-4 h-4 text-[#0b1c30]/40 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleSearch();
              }
            }}
            placeholder="Search address / village / pincode..."
            className="w-full rounded-[14px] bg-[#eff4ff] border border-white/70 pl-10 pr-4 py-3 text-sm text-[#0b1c30] outline-none focus:ring-2 focus:ring-[#93eabe]/60"
          />
        </div>
        <button
          type="button"
          onClick={handleSearch}
          disabled={busy}
          className="rounded-[14px] bg-white/70 hover:bg-white/80 backdrop-blur border border-white/70 px-4 text-sm font-bold text-[#0b1c30] transition disabled:opacity-60"
        >
          {busy ? "..." : "Search"}
        </button>
        <button
          type="button"
          onClick={handleLocate}
          disabled={locating}
          className="inline-flex items-center gap-1.5 rounded-[14px] bg-white/70 hover:bg-white/80 backdrop-blur border border-white/70 px-4 py-3 text-sm font-bold text-[#0b1c30] transition disabled:opacity-60"
        >
          {locating ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Locating you…
            </>
          ) : (
            <>
              <LocateFixed className="w-4 h-4" />
              Use my current location
            </>
          )}
        </button>
      </div>

      {geoError && (
        <div className="flex items-start gap-2 rounded-[16px] bg-white/70 backdrop-blur border border-white/70 px-4 py-3">
          <AlertTriangle className="w-4 h-4 text-[#b3261e] mt-0.5 shrink-0" />
          <div className="text-sm text-[#b3261e] leading-relaxed">{geoError}</div>
        </div>
      )}

      {selected && (
        <div className="flex items-start gap-2 rounded-[16px] bg-white/70 backdrop-blur border border-white/70 px-4 py-3">
          <MapPin className="w-4 h-4 text-[#005136] mt-0.5 shrink-0" />
          <div className="text-sm text-[#0b1c30]/70 leading-relaxed">
            <span className="font-semibold text-[#0b1c30]">Location selected ✓</span>
            {hint ? (
              <div className="mt-0.5">{hint}</div>
            ) : (
              <div className="mt-0.5">
                Lat: {pos.lat.toFixed(4)} · Lng: {pos.lng.toFixed(4)}
              </div>
            )}
          </div>
        </div>
      )}

      <div className="h-[320px] w-full overflow-hidden rounded-[24px] bg-white/70 backdrop-blur border border-white/70 shadow-[0_18px_60px_rgba(0,0,0,0.06)]">
        <MapContainer
          center={[camera.lat, camera.lng]}
          zoom={camera.zoom}
          style={{ height: "100%", width: "100%" }}
          scrollWheelZoom={true}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          <ClickToSetMarker onPick={(lat, lng) => applyLocation(lat, lng)} />
          <MapCamera
            lat={camera.lat}
            lng={camera.lng}
            zoom={camera.zoom}
            nonce={camera.nonce}
          />

          {selected && (
            <Marker
              ref={markerRef}
              position={markerPos}
              icon={markerIcon}
              draggable
              eventHandlers={{ dragend: handleMarkerDragEnd }}
            />
          )}
        </MapContainer>
      </div>

      <p className="text-xs text-[#0b1c30]/55">
        Tip: use “Use my current location”, or search a PIN / area — then click the map or drag the
        pin to your exact house.
      </p>
    </div>
  );
}
