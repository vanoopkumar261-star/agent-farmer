import "server-only";
import { searchAgriStores } from "./places";
import { addAddresses } from "./storeAddress";
import { classify, CATEGORY_RANK, type StoreCategory } from "./storeClassify";
import { SEARCH_RADIUS_KM } from "./storeConfig";
import { hazardAdmin } from "./hazards/store";

/**
 * Agri-supply shops near a farmer.
 *
 * ── What this used to do, and why it was wrong ───────────────────────────────
 * There was a `generated()` fallback that returned six invented shops — "Kisan
 * Agro Centre", "Sri Balaji Fertilizers" and four more — at points computed on
 * a circle around the farmer's house. It also gave every shop, real or invented,
 * a star rating produced by hashing its name.
 *
 * That fallback was not an edge case: it was the only path that ever ran.
 * Overpass answers HTTP 406 to Node's default user agent, so the OSM fetch threw
 * every time and the catch returned the invented list. And even with that fixed,
 * OSM has almost no agricultural shops mapped in rural India — 25 km around
 * Hubballi holds 72 shop nodes, one of which is agricultural.
 *
 * So every shop a farmer ever saw was fictional, which is exactly why Directions
 * opened Google Maps on an empty field: the link was correct, the coordinates
 * were trigonometry.
 *
 * Both the generator and the rating hash are gone. The chain is now
 * Places → OpenStreetMap → an honest empty result, and a caller that receives
 * an empty list must say so rather than fill the space.
 */

export type Store = {
  id: string;
  name: string;
  /**
   * What kind of place this is, as an i18n key — never a display string. The
   * label used to be hardcoded English, so a farmer reading the app in Kannada
   * still saw "Garden Centre".
   */
  labelKey: string;
  /** Suppliers rank above services; see CATEGORY_RANK in storeClassify. */
  category: StoreCategory;
  lat: number;
  lng: number;
  distanceKm: number;
  address: string | null;
  /**
   * Google's own place identifier, present only on the Places tier. It is what
   * lets a Directions link name the shop without any risk of Google resolving
   * that name against the wrong town — see `storeDirections.ts`.
   */
  placeId?: string | null;
  /** Which real source this came from. There is no third option any more. */
  source: "places" | "osm";
};

export function haversineKm(aLat: number, aLng: number, bLat: number, bLng: number) {
  const R = 6371;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((aLat * Math.PI) / 180) * Math.cos((bLat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}

export { SEARCH_RADIUS_KM };

type CachedStore = Omit<Store, "distanceKm">;

/**
 * Bump when the query or the classifier changes.
 *
 * `store_cache` keys on rounded coordinates and records neither the query nor a
 * TTL, so without this a locality cached before a filter change keeps serving
 * the old result set for ever. Folding a version into the key means every such
 * change invalidates itself; the stale rows simply stop being addressed.
 */
const FILTER_VERSION = "v2";

/** ~11 km buckets, so a locality shares one lookup. */
const cacheKey = (lat: number, lng: number) =>
  `${FILTER_VERSION}:${lat.toFixed(1)},${lng.toFixed(1)}`;

async function readCache(key: string): Promise<CachedStore[] | null> {
  const admin = hazardAdmin();
  if (!admin) return null;
  try {
    const { data } = await admin
      .from("store_cache")
      .select("stores")
      .eq("key", key)
      .maybeSingle();
    const rows = (data as { stores: CachedStore[] } | null)?.stores;
    return Array.isArray(rows) ? rows : null;
  } catch {
    return null; // table not migrated yet — behave as a miss
  }
}

async function writeCache(key: string, source: string, stores: CachedStore[]): Promise<void> {
  const admin = hazardAdmin();
  if (!admin || stores.length === 0) return;
  try {
    await admin
      .from("store_cache")
      .upsert(
        { key, source, stores, radius_km: SEARCH_RADIUS_KM },
        { onConflict: "key", ignoreDuplicates: false }
      );
  } catch {
    /* caching is an optimisation; the caller already has the data */
  }
}

/**
 * OpenStreetMap, via Overpass. The second tier: it finds almost nothing in rural
 * India, but it costs nothing and occasionally has a garden centre Google
 * missed.
 */
async function fromOverpass(lat: number, lng: number, radiusM: number): Promise<CachedStore[]> {
  // `nwr`, not `node`: a shop mapped as a building polygon is a way, and the
  // node-only query could never see one. That alone was hiding a real seed
  // supplier ("Zaildar Seed Farm") from the Ludhiana farmer.
  //
  // The tag list is wide because it no longer decides anything — `classify()`
  // does. Casting wide and gating on the name finds shops the tags get wrong in
  // both directions: it rescues a nursery mis-tagged `doityourself`, and drops
  // the car washes and property advisors that carry `shop=hardware`.
  //
  // The cap is high for the same reason. 231 candidates around Ludhiana reduce
  // to 14; truncating at 60 before the filter would throw away good shops to
  // keep bad ones.
  const query = `[out:json][timeout:40];
(
  nwr["shop"~"^(agrarian|garden_centre|farm|hardware|doityourself|trade|chemist|general|convenience|wholesale)$"](around:${radiusM},${lat},${lng});
  nwr["craft"="agricultural_engines"](around:${radiusM},${lat},${lng});
);
out center 400;`;

  const res = await fetch("https://overpass-api.de/api/interpreter", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      // Overpass answers 406 to Node's default `node` agent, so this route was
      // always falling through. Identify the app the way its policy asks.
      "User-Agent": "AgentFarmer/1.0 (https://github.com/agent-farmer)",
    },
    body: "data=" + encodeURIComponent(query),
    // Longer than the query's own [timeout:40] on purpose: aborting first turns
    // a slow-but-successful Overpass run into a bare "canceled" with nothing to
    // report. A 100 km radius is a heavier query than the old 25 km one.
    signal: AbortSignal.timeout(48000),
    next: { revalidate: 86400 },
  });
  if (!res.ok) throw new Error("overpass " + res.status);
  const data = await res.json();

  return (data.elements ?? [])
    .map((e: any) => {
      // Ways and relations carry `center` rather than `lat`/`lon`.
      const lat = e.lat ?? e.center?.lat;
      const lng = e.lon ?? e.center?.lon;
      const name = e.tags?.name as string | undefined;
      if (lat == null || lng == null || !name) return null;

      // The gate. An unrecognised shop is dropped, not relabelled: a farmer
      // sent to a car wash because it carried `shop=hardware` loses the trip.
      const c = classify(name, e.tags.shop);
      if (!c) return null;

      return {
        id: `osm-${e.type}-${e.id}`,
        name,
        labelKey: c.labelKey,
        category: c.category,
        lat: lat as number,
        lng: lng as number,
        address: (e.tags["addr:street"] as string) ?? null,
        source: "osm" as const,
      };
    })
    .filter((s: CachedStore | null): s is CachedStore => s !== null);
}

/**
 * Shops within SEARCH_RADIUS_KM, nearest first.
 *
 * An empty array is a real answer and means exactly what it says: nothing
 * verifiable was found. Callers must show that rather than substitute filler —
 * sending a farmer 90 km to a shop that does not exist costs them a day.
 */
export async function getNearbyStores(lat: number, lng: number): Promise<Store[]> {
  const key = cacheKey(lat, lng);

  const withDistance = (rows: CachedStore[]): Store[] =>
    rows
      .map((s) => ({ ...s, distanceKm: Number(haversineKm(lat, lng, s.lat, s.lng).toFixed(1)) }))
      // Google's bias returns places beyond the circle, which is how the radius
      // gets past its 50 km cap — so the real limit is enforced here.
      .filter((s) => s.distanceKm <= SEARCH_RADIUS_KM)
      // Suppliers before services, each nearest-first. A cold store or a mandi
      // is genuinely useful but is not what someone opening a *store* locator
      // is usually after, so it sits below the shops that sell inputs.
      .sort(
        (a, b) =>
          CATEGORY_RANK[a.category] - CATEGORY_RANK[b.category] ||
          a.distanceKm - b.distanceKm
      )
      .slice(0, 14);

  const cached = await readCache(key);
  if (cached) return withDistance(cached);

  const places = await searchAgriStores(lat, lng);
  if (places && places.length > 0) {
    // `p.id` is stored prefixed ("gp-…") to keep ids unique across sources;
    // Google needs the bare place_id back, so it is split out here rather than
    // reconstructed at render time.
    const rows: CachedStore[] = places.map((p) => ({
      ...p,
      placeId: p.id.startsWith("gp-") ? p.id.slice(3) : p.id,
      source: "places" as const,
    }));
    await writeCache(key, "places", rows);
    return withDistance(rows);
  }

  try {
    const osm = await fromOverpass(lat, lng, SEARCH_RADIUS_KM * 1000);
    if (osm.length > 0) {
      // Sort before geocoding, not after: `addAddresses` only looks up the
      // first few, and those should be the shops nearest the farmer.
      const nearestFirst = [...osm].sort(
        (a, b) => haversineKm(lat, lng, a.lat, a.lng) - haversineKm(lat, lng, b.lat, b.lng)
      );
      const located = await addAddresses(nearestFirst);
      await writeCache(key, "osm", located);
      return withDistance(located);
    }
  } catch (e) {
    console.error("STORES overpass error:", e);
  }

  // Nothing real within 100 km. Say so.
  return [];
}
