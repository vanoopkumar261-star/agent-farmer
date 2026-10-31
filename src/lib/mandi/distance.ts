/**
 * Real mandi distances — the thing the market board faked for a year.
 *
 * `recordsToMandiRows` used to set `distanceKm = 8 + i*12` (8, 20, 32…), a number
 * with no relation to where the farmer or the mandi actually is, and the UI called
 * it "verified". That made the transport cost, the recommended vehicle and the
 * "which mandi pays most after costs" ranking fiction. This replaces it with a real
 * road distance from the farmer's saved location to each mandi.
 *
 * Two public-OSM services, both server-side, both cached:
 *   1. Nominatim geocodes the mandi town (AGMARKNET names like "Nakodar APMC" are
 *      cleaned to "Nakodar", and the record's district is included so the many
 *      duplicate town names across India resolve to the right one).
 *   2. OSRM returns the driving distance from the farmer to each mandi, in one
 *      table call. If OSRM is unavailable, it falls back to straight-line × a road
 *      factor so a distance is still shown (flagged by the caller as approximate).
 *
 * Nothing here ever fabricates: a mandi that cannot be located returns null, and
 * the UI must render "distance unavailable" rather than invent one.
 */

export type LatLng = { lat: number; lon: number };

// Per-instance cache. Mandi coordinates never change, so a warm server reuses them;
// a persistent (Supabase) cache is the next step so cold starts don't re-geocode.
const coordCache = new Map<string, LatLng | null>();

const NOMINATIM = "https://nominatim.openstreetmap.org/search";
const OSRM = "https://router.project-osrm.org";
const UA = "agent-farmer/1.0 (mandi distance; +https://agent-farmer.vercel.app)";
const ROAD_FACTOR = 1.3; // straight-line → rough road distance, only for the OSRM fallback

const SUFFIX =
  /\b(a\.?p\.?m\.?c\.?|market\s*committee|market\s*yard|regulated\s*market|market|mandi|vfpck|yard|f&v|fruit\s*&?\s*veg\w*)\b/gi;

/** "Nakodar APMC" → "Nakodar"; "F.G.Churian APMC" → "F.G.Churian". */
export function cleanMandiName(market: string): string {
  return (market || "")
    .replace(/\(.*?\)/g, " ") // drop parenthetical qualifiers
    .replace(SUFFIX, " ")
    .replace(/[.,]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function geocodeOnce(query: string): Promise<LatLng | null> {
  const url = `${NOMINATIM}?q=${encodeURIComponent(query)}&format=json&limit=1&countrycodes=in`;
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA },
      // Coordinates are stable; cache a month at the fetch layer too.
      next: { revalidate: 2_592_000 },
    });
    if (!res.ok) return null;
    const arr = (await res.json()) as Array<{ lat: string; lon: string }>;
    if (!arr?.length) return null;
    const lat = parseFloat(arr[0].lat);
    const lon = parseFloat(arr[0].lon);
    return Number.isFinite(lat) && Number.isFinite(lon) ? { lat, lon } : null;
  } catch {
    return null;
  }
}

/**
 * The coordinates of a mandi, by its AGMARKNET market + district + state.
 * Tries the cleaned town within its district first (disambiguates duplicate town
 * names), then the district alone as a coarse fallback. Caches the result —
 * including a null, so a place OSM does not know is not retried every request.
 */
export async function mandiCoords(market: string, district: string, state: string): Promise<LatLng | null> {
  const key = `${market}|${district}|${state}`.toLowerCase();
  const cached = coordCache.get(key);
  if (cached !== undefined) return cached;

  const town = cleanMandiName(market);
  let coords =
    (town && (await geocodeOnce([town, district, state, "India"].filter(Boolean).join(", ")))) || null;
  if (!coords && district) {
    coords = await geocodeOnce([district, state, "India"].filter(Boolean).join(", "));
  }
  coordCache.set(key, coords);
  return coords;
}

function haversineKm(a: LatLng, b: LatLng): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLon = ((b.lon - a.lon) * Math.PI) / 180;
  const la1 = (a.lat * Math.PI) / 180;
  const la2 = (b.lat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/**
 * Driving distance (km) from `origin` to each destination, same order and length
 * as `dests`. Null destinations (un-geocodable mandis) stay null. One OSRM table
 * call does all of them; on any failure it falls back to straight-line × road
 * factor so the farmer still gets a usable figure.
 */
export async function roadDistancesKm(origin: LatLng, dests: (LatLng | null)[]): Promise<(number | null)[]> {
  const present = dests.map((d, i) => ({ d, i })).filter((x): x is { d: LatLng; i: number } => !!x.d);
  if (present.length === 0) return dests.map(() => null);

  const out: (number | null)[] = dests.map(() => null);
  const fallback = () => present.forEach(({ d, i }) => (out[i] = Math.round(haversineKm(origin, d) * ROAD_FACTOR)));

  try {
    const coords = [origin, ...present.map((p) => p.d)].map((p) => `${p.lon},${p.lat}`).join(";");
    const url = `${OSRM}/table/v1/driving/${coords}?sources=0&annotations=distance`;
    const res = await fetch(url, { next: { revalidate: 86_400 } });
    if (!res.ok) throw new Error(`osrm ${res.status}`);
    const j = (await res.json()) as { distances?: number[][] };
    const row = j.distances?.[0];
    if (!Array.isArray(row)) throw new Error("osrm: no distance table");
    present.forEach(({ d, i }, k) => {
      const meters = row[k + 1];
      out[i] = typeof meters === "number" ? Math.round(meters / 1000) : Math.round(haversineKm(origin, d) * ROAD_FACTOR);
    });
  } catch {
    fallback();
  }
  return out;
}
