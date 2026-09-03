import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { hazardAdmin } from "./store";
import type { GeoJsonGeometry } from "./geometry";

/**
 * District boundary geometry for the severity map.
 *
 * Nominatim will return an administrative boundary and simplify it server-side.
 * Measured on Dharwad: 4212 points / 100 KB raw, 150 points / 4 KB at
 * threshold 0.005 — still unmistakably the district, small enough to ride along
 * on the alert response.
 *
 * Fetched at most once per district, ever. A boundary does not change, and
 * Nominatim publishes no SLA for this kind of use, so the result is cached in
 * `district_outlines` (migration 023) as shared reference data. The browser
 * cannot call Nominatim itself under the app's `connect-src 'self'` CSP, and
 * shouldn't: the same identifying User-Agent discipline as `/api/geocode`
 * applies here.
 */

const NOMINATIM = "https://nominatim.openstreetmap.org";
const UA = "AgentFarmer/1.0 (district severity map; +https://github.com/)";
/** 150 points for a mid-size district — see the measurements above. */
const THRESHOLD = "0.005";
const SOURCE = `nominatim:${THRESHOLD}`;
const TIMEOUT_MS = 12_000;

export type DistrictOutline = {
  district: string;
  state: string | null;
  geojson: GeoJsonGeometry;
};

const keyFor = (district: string, state: string | null) =>
  `${district}|${state ?? ""}`.toLowerCase().trim();

async function readCache(
  admin: SupabaseClient,
  key: string
): Promise<DistrictOutline | null> {
  try {
    const { data } = await admin
      .from("district_outlines")
      .select("district, state, geojson")
      .eq("key", key)
      .maybeSingle();
    if (!data?.geojson) return null;
    return data as DistrictOutline;
  } catch {
    // Table absent (migration 023 not applied) — behave as a cache miss, and
    // the write below will no-op too.
    return null;
  }
}

/**
 * Ask Nominatim for the district boundary.
 *
 * Queried as "<district> district <state>" because the bare name is ambiguous
 * across India — "Bhopal" is a city and a district, and several districts share
 * a name with their headquarters town. The result is only accepted if it comes
 * back as `boundary/administrative`; a `place/city` hit is the wrong shape and
 * would draw a town centre where a district should be.
 */
async function fetchOutline(
  district: string,
  state: string | null
): Promise<DistrictOutline | null> {
  const q = `${district} district${state ? ` ${state}` : ""}`;
  const url =
    `${NOMINATIM}/search?format=json&q=${encodeURIComponent(q)}` +
    `&countrycodes=in&polygon_geojson=1&polygon_threshold=${THRESHOLD}&limit=1`;

  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "application/json" },
      signal: ctl.signal,
      next: { revalidate: 86_400 },
    });
    if (!res.ok) return null;
    const arr = await res.json();
    const rec = Array.isArray(arr) ? arr[0] : null;
    if (!rec?.geojson) return null;

    if (rec.class !== "boundary" || rec.type !== "administrative") {
      console.warn(
        `OUTLINE rejected non-boundary result for "${q}": ${rec.class}/${rec.type}`
      );
      return null;
    }
    const g = rec.geojson as GeoJsonGeometry;
    if (g.type !== "Polygon" && g.type !== "MultiPolygon") return null;

    return { district, state, geojson: g };
  } catch (e: any) {
    console.error(`OUTLINE fetch failed for "${q}":`, e?.message ?? e);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Cached district outline, or null.
 *
 * Null is a perfectly good answer — the map degrades to a plain status band and
 * the alert list is untouched. Nothing here may throw: the outline is
 * atmosphere, the alerts are the safety-critical content.
 */
export async function getDistrictOutline(
  district: string | null | undefined,
  state: string | null | undefined
): Promise<DistrictOutline | null> {
  if (!district) return null;

  const admin = hazardAdmin();
  if (!admin) return null;

  const key = keyFor(district, state ?? null);

  const cached = await readCache(admin, key);
  if (cached) return cached;

  const fresh = await fetchOutline(district, state ?? null);
  if (!fresh) return null;

  try {
    await admin.from("district_outlines").upsert(
      {
        key,
        district: fresh.district,
        state: fresh.state,
        geojson: fresh.geojson,
        source: SOURCE,
      },
      { onConflict: "key", ignoreDuplicates: true }
    );
  } catch {
    /* cache write is an optimisation; the caller already has the geometry */
  }

  return fresh;
}
