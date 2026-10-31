/**
 * Real mandi distances — the thing the market board faked for a year.
 *
 * `recordsToMandiRows` used to set `distanceKm = 8 + i*12` (8, 20, 32…), a number
 * with no relation to where the farmer or the mandi actually is, and the UI called
 * it "verified". That made the transport cost, the recommended vehicle and the
 * "which mandi pays most after costs" ranking fiction. This replaces it with a real
 * road distance from the farmer's saved location to each mandi.
 *
 *   1. Nominatim geocodes the mandi town (AGMARKNET names like "Nakodar APMC" are
 *      cleaned to "Nakodar", and the record's district is included so the many
 *      duplicate town names across India resolve to the right one). Results are
 *      cached in `mandi_geocache` (migration 008) so Nominatim's 1 req/s limit is
 *      respected: a mandi is geocoded once, ever, then read from the DB.
 *   2. OSRM returns the driving distance from the farmer to each located mandi, in
 *      one table call. On failure it falls back to straight-line × a road factor.
 *
 * Nothing here ever fabricates: a mandi that cannot be located is left null, and
 * the UI must render "distance unavailable" rather than invent one. The persistent
 * cache is written through the service role (shared reference data; see 008), so it
 * degrades to in-memory-only if the service key is absent.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export type LatLng = { lat: number; lon: number };

// Within one warm server, avoid even the DB round-trip for a coord already seen.
const memCache = new Map<string, LatLng | null>();

// Cap on NEW (uncached) geocodes per request, so one page load can never block on
// Nominatim for long or burst past its limit. The warm script fills the rest.
const MAX_INLINE_GEOCODES = 8;

const NOMINATIM = "https://nominatim.openstreetmap.org/search";
const OSRM = "https://router.project-osrm.org";
const UA = "agent-farmer/1.0 (mandi distance; +https://agent-farmer.vercel.app)";
const ROAD_FACTOR = 1.3; // straight-line → rough road distance, only for the OSRM fallback

const SUFFIX =
  /\b(a\.?p\.?m\.?c\.?|market\s*committee|market\s*yard|regulated\s*market|market|mandi|vfpck|yard|f&v|fruit\s*&?\s*veg\w*)\b/gi;

/** "Nakodar APMC" → "Nakodar"; "F.G.Churian APMC" → "F G Churian". */
export function cleanMandiName(market: string): string {
  return (market || "")
    .replace(/\(.*?\)/g, " ")
    .replace(SUFFIX, " ")
    .replace(/[.,]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function cacheKey(market: string, district: string, state: string): string {
  return `${market}|${district}|${state}`.toLowerCase();
}

function geocacheAdmin(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

async function geocodeOnce(query: string): Promise<LatLng | null> {
  const url = `${NOMINATIM}?q=${encodeURIComponent(query)}&format=json&limit=1&countrycodes=in`;
  try {
    const res = await fetch(url, { headers: { "User-Agent": UA }, next: { revalidate: 2_592_000 } });
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

/** Geocode one mandi (town-in-district, then district alone). Returns coords + how. */
async function geocodeMandi(
  market: string,
  district: string,
  state: string
): Promise<{ coords: LatLng | null; source: "geocoded" | "district" | "none" }> {
  const town = cleanMandiName(market);
  let coords = town ? await geocodeOnce([town, district, state, "India"].filter(Boolean).join(", ")) : null;
  if (coords) return { coords, source: "geocoded" };
  if (district) {
    coords = await geocodeOnce([district, state, "India"].filter(Boolean).join(", "));
    if (coords) return { coords, source: "district" };
  }
  return { coords: null, source: "none" };
}

async function readCache(admin: SupabaseClient, keys: string[]): Promise<Map<string, LatLng | null>> {
  const out = new Map<string, LatLng | null>();
  if (keys.length === 0) return out;
  try {
    const { data } = await admin.from("mandi_geocache").select("key,lat,lng").in("key", keys);
    for (const r of data ?? []) {
      out.set(r.key, r.lat != null && r.lng != null ? { lat: r.lat, lon: r.lng } : null);
    }
  } catch {
    // Table missing / unreachable → treat everything as a miss; geocode path handles it.
  }
  return out;
}

async function writeCache(
  admin: SupabaseClient,
  rows: Array<{ key: string; coords: LatLng | null; source: string }>
): Promise<void> {
  if (rows.length === 0) return;
  try {
    await admin.from("mandi_geocache").upsert(
      rows.map((r) => ({ key: r.key, lat: r.coords?.lat ?? null, lng: r.coords?.lon ?? null, source: r.source })),
      { onConflict: "key" }
    );
  } catch {
    // A failed cache write just means the next request re-geocodes; never fatal.
  }
}

/** One mandi's coordinates, cache-first. Used by the warm script and single lookups. */
export async function mandiCoords(market: string, district: string, state: string): Promise<LatLng | null> {
  const key = cacheKey(market, district, state);
  const mem = memCache.get(key);
  if (mem !== undefined) return mem;

  const admin = geocacheAdmin();
  if (admin) {
    const cached = await readCache(admin, [key]);
    if (cached.has(key)) {
      const c = cached.get(key)!;
      memCache.set(key, c);
      return c;
    }
  }
  const { coords, source } = await geocodeMandi(market, district, state);
  if (admin) await writeCache(admin, [{ key, coords, source }]);
  memCache.set(key, coords);
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

/** Driving distance (km) from origin to each dest, same order; nulls stay null. */
export async function roadDistancesKm(origin: LatLng, dests: (LatLng | null)[]): Promise<(number | null)[]> {
  const present = dests.map((d, i) => ({ d, i })).filter((x): x is { d: LatLng; i: number } => !!x.d);
  const out: (number | null)[] = dests.map(() => null);
  if (present.length === 0) return out;

  try {
    const coords = [origin, ...present.map((p) => p.d)].map((p) => `${p.lon},${p.lat}`).join(";");
    const res = await fetch(`${OSRM}/table/v1/driving/${coords}?sources=0&annotations=distance`, {
      next: { revalidate: 86_400 },
    });
    if (!res.ok) throw new Error(`osrm ${res.status}`);
    const row = ((await res.json()) as { distances?: number[][] }).distances?.[0];
    if (!Array.isArray(row)) throw new Error("osrm: no distance table");
    present.forEach(({ d, i }, k) => {
      const m = row[k + 1];
      out[i] = typeof m === "number" ? Math.round(m / 1000) : Math.round(haversineKm(origin, d) * ROAD_FACTOR);
    });
  } catch {
    present.forEach(({ d, i }) => (out[i] = Math.round(haversineKm(origin, d) * ROAD_FACTOR)));
  }
  return out;
}

/**
 * Fill `distanceKm` on each row with the real road distance from `origin`.
 * Cache-first and batched: one DB read for all keys, at most MAX_INLINE_GEOCODES
 * new geocodes (the rest left null for the warm script to fill), one DB write, one
 * OSRM call. Mutates and returns the same rows. With no origin, leaves them null.
 */
export async function attachRoadDistances<T extends { mandi: string; district?: string; distanceKm: number | null }>(
  origin: LatLng | null,
  state: string,
  rows: T[]
): Promise<T[]> {
  if (!origin || rows.length === 0) return rows;

  const keys = rows.map((r) => cacheKey(r.mandi, r.district ?? "", state));
  const admin = geocacheAdmin();
  const cached = admin ? await readCache(admin, keys) : new Map<string, LatLng | null>();

  const coords: (LatLng | null)[] = new Array(rows.length).fill(null);
  const toWrite: Array<{ key: string; coords: LatLng | null; source: string }> = [];
  let geocoded = 0;

  for (let i = 0; i < rows.length; i++) {
    const key = keys[i];
    const mem = memCache.get(key);
    if (mem !== undefined) {
      coords[i] = mem;
      continue;
    }
    if (cached.has(key)) {
      coords[i] = cached.get(key)!;
      memCache.set(key, coords[i]);
      continue;
    }
    if (geocoded < MAX_INLINE_GEOCODES) {
      geocoded++;
      const { coords: c, source } = await geocodeMandi(rows[i].mandi, rows[i].district ?? "", state);
      coords[i] = c;
      memCache.set(key, c);
      toWrite.push({ key, coords: c, source });
    }
    // else: left null this request; the warm script / a later load fills it.
  }

  if (admin && toWrite.length) await writeCache(admin, toWrite);

  const dists = await roadDistancesKm(origin, coords);
  rows.forEach((r, i) => (r.distanceKm = dists[i]));
  return rows;
}
