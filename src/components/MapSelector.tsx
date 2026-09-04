"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Circle, MapContainer, Marker, TileLayer, useMap, useMapEvents } from "react-leaflet";
import { MapPin, LocateFixed, Loader2, AlertTriangle } from "lucide-react";

export type SelectedLocation = {
  lat: number;
  lng: number;
  address?: string;
  /** Postal (PIN) code, when the geocoder can resolve one. */
  pincode?: string;
  /**
   * Administrative district and state.
   *
   * `/api/geocode` has always returned these and this component always threw
   * them away, so `house_district`/`house_state` were left to a string-parse of
   * the display address in db.ts — which fails whenever Nominatim's wording
   * doesn't match the parser. Only 7 of 26 live profiles have them, and a
   * profile without them gets no severe-weather alerts at all. Passing them
   * through is the fix.
   */
  district?: string;
  state?: string;
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

type GeoResult = { address?: string; pincode?: string; district?: string; state?: string };

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
    return {
      address: data?.address || undefined,
      pincode: data?.pincode || undefined,
      district: data?.district || undefined,
      state: data?.state || undefined,
    };
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
      district: data.district || undefined,
      state: data.state || undefined,
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
  const [locating, setLocating] = useState(false); // geolocation in flight
  const [hint, setHint] = useState<string | undefined>(value?.address);
  const [selected, setSelected] = useState(Boolean(value?.lat && value?.lng));
  const [geoError, setGeoError] = useState<string | undefined>(undefined);
  /**
   * Radius of the GPS fix in metres, or undefined for a hand-placed pin.
   *
   * This was read off `position.coords` and discarded, so a 2 km indoor fix
   * produced exactly the same confident "Location selected" as a rooftop fix.
   * A farmer cannot correct what they are not told is wrong.
   */
  const [accuracyM, setAccuracyM] = useState<number | undefined>(undefined);
  /** Shown only after GPS has actually failed — never offered up front. */
  const [showPin, setShowPin] = useState(false);
  const [pin, setPin] = useState("");
  const [pinBusy, setPinBusy] = useState(false);

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
    (lat: number, lng: number, recenterZoom?: number, accuracy?: number) => {
      const seq = ++seqRef.current;
      setPos({ lat, lng });
      setSelected(true);
      setGeoError(undefined);
      setAccuracyM(accuracy);
      setHint(undefined); // clear the previous address while the new one resolves
      if (recenterZoom != null) {
        setCamera((c) => ({ lat, lng, zoom: recenterZoom, nonce: c.nonce + 1 }));
      }
      onChange({ lat, lng });

      reverseGeocode(lat, lng).then((r) => {
        if (seqRef.current !== seq) return; // superseded by a newer pick
        setHint(r.address);
        onChange({
          lat,
          lng,
          address: r.address,
          pincode: r.pincode,
          district: r.district,
          state: r.state,
        });
      });
    },
    [onChange]
  );

  const handleLocate = useCallback(() => {
    if (locating) return;
    setGeoError(undefined);
    // Any failure below reveals the PIN entry — the error copy promises it.
    setShowPin(true);

    if (typeof window !== "undefined" && !window.isSecureContext) {
      setGeoError(
        "This device cannot share its location here. Enter your PIN code below instead."
      );
      return;
    }
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      setGeoError("This phone cannot share its location. Enter your PIN code below instead.");
      return;
    }

    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setLocating(false);
        // Zoom out a little for a coarse fix — showing a 2 km-wide fix at
        // house zoom implies a precision the reading does not have.
        const acc = p.coords.accuracy;
        const zoom = acc > 500 ? 14 : HOUSE_ZOOM;
        applyLocation(p.coords.latitude, p.coords.longitude, zoom, acc);
      },
      (err) => {
        setLocating(false);
        if (err.code === err.PERMISSION_DENIED) {
          setGeoError(
            "We could not read your location. Allow location access and press the button again, or enter your PIN code below."
          );
        } else if (err.code === err.TIMEOUT) {
          setGeoError(
            "That took too long. Press the button again, or enter your PIN code below."
          );
        } else {
          setGeoError("We could not find your location. Enter your PIN code below instead.");
        }
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  }, [locating, applyLocation]);


  /**
   * The last resort when GPS will not work.
   *
   * Reuses the forward-geocode path that `/api/geocode` already special-cases
   * for a 6-digit PIN (it tries `postalcode=` first, then the PIN as a plain
   * query). Lands at area zoom, not house zoom, because a PIN is a
   * neighbourhood — the farmer then drags onto their own field.
   */
  const handlePin = useCallback(async () => {
    if (pin.length !== 6 || pinBusy) return;
    setPinBusy(true);
    const hit = await geocode(pin);
    setPinBusy(false);
    if (!hit) {
      setGeoError(
        `We could not find PIN code ${pin}. Check the six digits, or ask someone to help you place the pin on the map.`
      );
      return;
    }
    // No accuracy figure: a PIN is an area, so the pin needs dragging either
    // way, and the "roughly here" wording says so.
    applyLocation(hit.lat, hit.lng, PIN_ZOOM, 2000);
    setShowPin(false);
  }, [pin, pinBusy, applyLocation]);

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
      {/* One primary action. The address search box that used to sit here is
          gone: it asked a farmer who may not read to type a place name, and it
          competed with the button that needs no reading at all. */}
      <button
        type="button"
        onClick={handleLocate}
        disabled={locating}
        className="w-full inline-flex items-center justify-center gap-2.5 rounded-[16px] bg-af-primary hover:bg-af-primary-deep text-white px-5 py-4 text-[15px] font-semibold transition active:scale-[0.99] shadow-af-sm disabled:opacity-60"
      >
        {locating ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            Finding your location…
          </>
        ) : (
          <>
            <LocateFixed className="w-5 h-5" />
            Use my current location
          </>
        )}
      </button>

      {geoError && (
        <div className="rounded-[16px] bg-white/70 backdrop-blur border border-white/70 px-4 py-3">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-[#b3261e] mt-0.5 shrink-0" />
            <div className="text-sm text-[#b3261e] leading-relaxed">{geoError}</div>
          </div>

          {/* The only typed input left, and only when GPS has already failed.
              Six digits on a number pad is a different task from writing an
              address, and it is the one input `/api/geocode` special-cases. */}
          {showPin && (
            <div className="mt-3 border-t border-white/70 pt-3">
              <label className="block text-sm font-semibold text-[#0b1c30]">
                Enter your 6-digit PIN code
              </label>
              <div className="mt-2 flex gap-2">
                <input
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      void handlePin();
                    }
                  }}
                  inputMode="numeric"
                  autoComplete="postal-code"
                  placeholder="580021"
                  className="w-40 rounded-[14px] bg-[#eff4ff] border border-white/70 px-4 py-3 text-lg font-mono tracking-[0.3em] text-[#0b1c30] outline-none focus:ring-2 focus:ring-[#93eabe]/60"
                />
                <button
                  type="button"
                  onClick={() => void handlePin()}
                  disabled={pin.length !== 6 || pinBusy}
                  className="rounded-[14px] bg-af-primary hover:bg-af-primary-deep text-white px-5 text-sm font-semibold transition disabled:opacity-50"
                >
                  {pinBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : "Find"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {selected && (
        <div className="flex items-start gap-2 rounded-[16px] bg-white/70 backdrop-blur border border-white/70 px-4 py-3">
          <MapPin className="w-4 h-4 text-[#005136] mt-0.5 shrink-0" />
          <div className="text-sm text-[#0b1c30]/70 leading-relaxed">
            {/* A coarse fix is not a location. Saying so, and asking for a drag,
                is the difference between a farm pin on the right field and one
                two kilometres away that nobody was told to check. */}
            <span className="font-semibold text-[#0b1c30]">
              {accuracyM != null && accuracyM > 500
                ? "Roughly here — drag the pin onto your field"
                : "Location selected ✓"}
            </span>
            {hint ? (
              <div className="mt-0.5">{hint}</div>
            ) : (
              <div className="mt-0.5">
                Lat: {pos.lat.toFixed(4)} · Lng: {pos.lng.toFixed(4)}
              </div>
            )}
            {accuracyM != null && (
              <div className="mt-0.5 text-[12px]">
                Accurate to about {accuracyM < 1000
                  ? `${Math.round(accuracyM)} m`
                  : `${(accuracyM / 1000).toFixed(1)} km`}
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
          {/* Satellite, not streets. A farmer recognises their own field from
              the air — the shape of the plot, the trees along the bund. On a
              street map there is nothing to recognise, which is exactly the
              problem now that there is no search box to type a village into. */}
          <TileLayer
            attribution="Imagery &copy; Esri, Maxar, Earthstar Geographics"
            url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
            maxZoom={19}
          />
          {/* Place names over the imagery, or the picture is unnavigable. */}
          <TileLayer
            url="https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}"
            maxZoom={19}
          />

          <ClickToSetMarker onPick={(lat, lng) => applyLocation(lat, lng)} />
          <MapCamera
            lat={camera.lat}
            lng={camera.lng}
            zoom={camera.zoom}
            nonce={camera.nonce}
          />

          {/* How wide the GPS fix actually was. Drawing it is what turns
              "drag the pin onto your field" from an instruction into an
              obvious one — the farmer can see the circle covers three villages. */}
          {selected && accuracyM != null && accuracyM > 100 && (
            <Circle
              center={markerPos}
              radius={accuracyM}
              pathOptions={{ color: "#284D35", weight: 1.5, fillColor: "#284D35", fillOpacity: 0.12 }}
            />
          )}

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
        Press the green button. Then drag the pin onto your own field — you can see it
        from above.</p>
    </div>
  );
}
