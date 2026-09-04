import "server-only";
import { fetchWithRetry } from "./http";
import { classify, type StoreCategory } from "./storeClassify";

/**
 * Google Places (New) Text Search — real agri-supply shops.
 *
 * OpenStreetMap has effectively no agricultural shops mapped in rural India:
 * within 25 km of Hubballi, a city of about a million, OSM holds 72 shop nodes
 * and exactly one of them is agricultural. Google's coverage is where the data
 * actually lives — "krishi kendra", "agro centre", "fertilizer shop" are all
 * well represented.
 *
 * ── The field mask is a cost decision ────────────────────────────────────────
 * Google bills a call at the highest tier of ANY field requested. Everything
 * below is Pro, which carries 5,000 free calls a month. Adding `places.rating`,
 * `places.currentOpeningHours` or `places.websiteUri` re-prices the whole call
 * to Enterprise and drops that allowance to 1,000. Do not add fields here
 * casually — one word quietly costs 80% of the budget.
 */

const ENDPOINT = "https://places.googleapis.com/v1/places:searchText";

/** Pro-tier fields only. See the note above before touching this. */
const FIELD_MASK = [
  "places.id",
  "places.displayName",
  "places.formattedAddress",
  "places.location",
  "places.types",
].join(",");

/**
 * Google's hard cap: "The radius must be between 0.0 and 50000.0, inclusive."
 * The 100 km search is built from this, not requested — see searchAgriStores.
 */
const MAX_BIAS_M = 50_000;

const QUERY = "agricultural supplies fertilizer seeds pesticides krishi kendra agro centre";

export type PlaceResult = {
  id: string;
  name: string;
  labelKey: string;
  category: StoreCategory;
  lat: number;
  lng: number;
  address: string | null;
};

/**
 * What to call a Google result, as an i18n key.
 *
 * The name is tried first, through the same classifier the OSM tier uses, so
 * "Sri Balaji Krishi Kendra" is labelled from what it says rather than from
 * Google's generic `store` type. Google's own types are the fallback.
 *
 * Unlike the OSM tier this never DROPS anything. Places is reached by a text
 * search for agricultural supplies, so a result is already an answer to an agri
 * question; re-gating it on our keyword list would discard genuine shops whose
 * names happen not to say "agri" — "Roots and Shoots" being exactly that case.
 * If Places turns out noisy once a key is live, `classify` is right here and
 * the gate is one line.
 */
function labelFor(name: string, types: string[] | undefined): {
  labelKey: string;
  category: StoreCategory;
} {
  const byName = classify(name, "agrarian");
  if (byName) return byName;

  const t = new Set(types ?? []);
  if (t.has("garden_center") || t.has("florist"))
    return { labelKey: "storeType.nursery", category: "supplies" };
  if (t.has("pharmacy") || t.has("drugstore"))
    return { labelKey: "storeType.agroChemist", category: "supplies" };
  return { labelKey: "storeType.agriSupplies", category: "supplies" };
}

/** One Text Search call biased at a point. Null on any failure — never throws. */
async function searchAt(
  lat: number,
  lng: number,
  apiKey: string
): Promise<PlaceResult[] | null> {
  try {
    const res = await fetchWithRetry(
      ENDPOINT,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": apiKey,
          "X-Goog-FieldMask": FIELD_MASK,
        },
        body: JSON.stringify({
          textQuery: QUERY,
          // BIAS, not restriction. `locationRestriction` would exclude anything
          // outside the circle and cap us at Google's 50 km maximum for good;
          // a bias merely prefers the area and still returns places beyond it,
          // which is the only way to reach 100 km in one call.
          locationBias: { circle: { center: { latitude: lat, longitude: lng }, radius: MAX_BIAS_M } },
          // One page. Each `nextPageToken` fetch is another billable call, and
          // the list is capped for display well below 20 anyway.
          pageSize: 20,
          languageCode: "en",
          regionCode: "IN",
        }),
      },
      { retries: 1, label: "places/searchText" }
    );

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      console.error(`PLACES ${res.status}:`, detail.slice(0, 300));
      return null;
    }

    const data = await res.json();
    return (data.places ?? [])
      .filter((p: any) => p?.location?.latitude != null && p?.displayName?.text)
      .map((p: any) => ({
        id: `gp-${p.id}`,
        name: p.displayName.text as string,
        ...labelFor(p.displayName.text as string, p.types),
        lat: p.location.latitude as number,
        lng: p.location.longitude as number,
        address: (p.formattedAddress as string) ?? null,
      }));
  } catch (e: any) {
    console.error("PLACES failed:", e?.message ?? e);
    return null;
  }
}

/**
 * Shops within SEARCH_RADIUS_KM of a point.
 *
 * Google caps a location bias at 50 km, so the wider radius is assembled: one
 * central search first, and only if that comes back thin — bias concentrates
 * results near its centre, so the outer ring is often sparse — up to four more
 * biased at points ~60 km out. Those extra calls are conditional because each
 * one is billable; the caller caches the result so a locality pays once.
 *
 * Returns null when no key is configured, so the caller can fall through to
 * OpenStreetMap rather than treating it as "no shops exist".
 */
export async function searchAgriStores(
  lat: number,
  lng: number
): Promise<PlaceResult[] | null> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) return null;

  const first = await searchAt(lat, lng, apiKey);
  if (first === null) return null;

  const byId = new Map<string, PlaceResult>();
  for (const p of first) byId.set(p.id, p);

  // Only reach for the outer ring when the centre did not supply enough.
  if (byId.size < 8) {
    const OFFSET_KM = 60;
    const dLat = OFFSET_KM / 111;
    const dLng = OFFSET_KM / (111 * Math.cos((lat * Math.PI) / 180));
    const ring: [number, number][] = [
      [lat + dLat, lng],
      [lat - dLat, lng],
      [lat, lng + dLng],
      [lat, lng - dLng],
    ];
    for (const [rLat, rLng] of ring) {
      const more = await searchAt(rLat, rLng, apiKey);
      for (const p of more ?? []) byId.set(p.id, p);
      if (byId.size >= 14) break;
    }
  }

  return Array.from(byId.values());
}
