import "server-only";
import { createClient } from "@supabase/supabase-js";
import { haversineKm } from "./stores";

/**
 * Distance from the farmer's house to each mandi.
 *
 * The Agmarknet feed ships no coordinates — only market name, district, state —
 * so distance has to be resolved by geocoding. Two passes, best first:
 *
 *   "geocoded"  The market name resolved. In practice OSM almost never has the
 *               APMC yard itself tagged — it matches the TOWN the yard sits in
 *               (and occasionally an arbitrary POI within that town). So treat
 *               this as town-level, ±2-5 km, not yard-level.
 *   "district"  Only the district resolved, so we use its centre. This is a
 *               ±20-30 km approximation and is labelled as such everywhere it
 *               surfaces, because it feeds straight into the transport cost.
 *   "unknown"   Nothing resolved. No distance shown, no transport line added —
 *               we never fabricate a number to fill the gap.
 *
 * Nominatim asks for <=1 request/second and a real User-Agent, so results are
 * cached permanently in `mandi_geocache` (migration 008) and only a small number
 * of new lookups run per page load. Everything degrades to "unknown" on failure.
 */

export type GeoPoint = { lat: number; lng: number; source: "geocoded" | "district" };

export type MandiKey = { market: string; district: string; state: string };

/** Max fresh Nominatim lookups per request — the rest resolve on later loads. */
const LOOKUP_BUDGET = 8;
const NOMINATIM = "https://nominatim.openstreetmap.org/search";
const UA = "AgentFarmer/1.0 (farm advisory app; mandi distance lookup)";

const keyOf = (m: MandiKey) =>
  `${m.market}|${m.district}|${m.state}`.toLowerCase().replace(/\s+/g, " ").trim();

/** Service-role client — the geocache is shared reference data, not farmer-owned. */
function cacheClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

async function nominatim(query: string): Promise<{ lat: number; lng: number } | null> {
  try {
    const url = `${NOMINATIM}?${new URLSearchParams({
      q: query,
      format: "json",
      limit: "1",
      countrycodes: "in",
    })}`;
    const res = await fetch(url, {
      headers: { "User-Agent": UA, "Accept-Language": "en" },
      signal: AbortSignal.timeout(8000),
      next: { revalidate: 2_592_000 }, // 30 days
    });
    if (!res.ok) return null;
    const json = await res.json();
    const hit = Array.isArray(json) ? json[0] : null;
    if (!hit?.lat || !hit?.lon) return null;
    return { lat: Number(hit.lat), lng: Number(hit.lon) };
  } catch {
    return null;
  }
}

/**
 * Strip the Agmarknet market string down to something OSM can match.
 * Feed values look like "Jalandhar City(Jalandhar) APMC" — the parenthesised
 * district and the APMC/Market suffix both hurt the match rate.
 */
function searchable(market: string): string {
  return market
    .replace(/\([^)]*\)/g, " ")
    .replace(/\b(apmc|market|mandi|committee)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function resolveOne(m: MandiKey): Promise<GeoPoint | null> {
  const name = searchable(m.market);
  if (name) {
    const hit = await nominatim(`${name}, ${m.district}, ${m.state}, India`);
    if (hit) return { ...hit, source: "geocoded" };
  }
  if (m.district) {
    const hit = await nominatim(`${m.district}, ${m.state}, India`);
    if (hit) return { ...hit, source: "district" };
  }
  return null;
}

/**
 * Resolve coordinates for a batch of mandis, reading cache first and geocoding
 * at most LOOKUP_BUDGET misses. Returns a map keyed by `keyOf`.
 */
export async function resolveMandiPoints(mandis: MandiKey[]): Promise<Map<string, GeoPoint>> {
  const out = new Map<string, GeoPoint>();
  if (mandis.length === 0) return out;

  // Dedupe — the same market reports many commodities.
  const unique = new Map<string, MandiKey>();
  for (const m of mandis) if (m.market) unique.set(keyOf(m), m);
  const keys = Array.from(unique.keys());

  const db = cacheClient();

  // ── Pass 1: cache ──
  const missing: string[] = [];
  if (db) {
    try {
      const { data } = await db.from("mandi_geocache").select("*").in("key", keys);
      for (const row of data ?? []) {
        if (row.source === "none" || row.lat == null || row.lng == null) continue;
        out.set(row.key, { lat: row.lat, lng: row.lng, source: row.source });
      }
      const seen = new Set((data ?? []).map((r: any) => r.key));
      for (const k of keys) if (!seen.has(k)) missing.push(k);
    } catch {
      missing.push(...keys); // table not migrated yet — geocode without caching
    }
  } else {
    missing.push(...keys);
  }

  // ── Pass 2: geocode a bounded number of misses, sequentially (rate limit) ──
  const toLookup = missing.slice(0, LOOKUP_BUDGET);
  const writes: any[] = [];
  for (const k of toLookup) {
    const point = await resolveOne(unique.get(k)!);
    if (point) out.set(k, point);
    writes.push({ key: k, lat: point?.lat ?? null, lng: point?.lng ?? null, source: point?.source ?? "none" });
  }

  if (db && writes.length) {
    try {
      await db.from("mandi_geocache").upsert(writes, { onConflict: "key" });
    } catch {
      /* cache is an optimisation, never a requirement */
    }
  }

  return out;
}

/** Distance in km from the farm to a mandi, or null when it couldn't be resolved. */
export function distanceTo(
  points: Map<string, GeoPoint>,
  m: MandiKey,
  farmLat?: number | null,
  farmLng?: number | null
): { km: number | null; source: "geocoded" | "district" | "unknown" } {
  if (farmLat == null || farmLng == null) return { km: null, source: "unknown" };
  const p = points.get(keyOf(m));
  if (!p) return { km: null, source: "unknown" };
  return { km: Number(haversineKm(farmLat, farmLng, p.lat, p.lng).toFixed(1)), source: p.source };
}
