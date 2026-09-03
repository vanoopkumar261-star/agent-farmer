import "server-only";

/**
 * Addresses for OpenStreetMap shops, so their Directions links can name them.
 *
 * OSM shop nodes in rural India almost never carry `addr:*` tags — all three
 * shops within 100 km of the Hubballi test farmer had none. Without an address
 * the Directions link can only send a coordinate, which is what made Google
 * label a garden centre as a salon. Reverse geocoding fills that gap: every one
 * of those three resolved to a specific, usable address.
 *
 * The Places tier never comes through here — it gets `formattedAddress` from
 * Google for free, in the same call that returns the shop.
 *
 * ── The rate limit is the design constraint ──────────────────────────────────
 * Nominatim's usage policy is an absolute maximum of one request per second,
 * and it is a free service run on donated hardware; going faster gets the app
 * blocked and is a bad way to treat it. So calls are strictly sequential and
 * spaced, which makes this slow by construction — and that is why it runs only
 * on a cache miss, only for the nearest few shops, and never on a warm load.
 */

const NOMINATIM = "https://nominatim.openstreetmap.org/reverse";
const SPACING_MS = 1100;

/** Only the nearest few matter — nobody drives to the 9th-closest shop. */
const MAX_LOOKUPS = 8;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Build the anchor Google needs. Ordered widest-last so the string reads like a
 * postal address, and deliberately excludes the shop's own name: the caller
 * prepends that, and repeating it makes the query worse, not better.
 */
function formatAddress(a: Record<string, string> | undefined): string | null {
  if (!a) return null;
  const parts = [
    a.road,
    a.suburb ?? a.village ?? a.hamlet,
    a.town ?? a.city ?? a.municipality,
    a.state_district ?? a.county,
    a.state,
  ].filter((p): p is string => typeof p === "string" && p.length > 0);

  // De-duplicate: Nominatim frequently repeats a name across levels (Sirsi as
  // both town and taluk), and a doubled term skews Google's match.
  const seen = new Set<string>();
  const uniq = parts.filter((p) => {
    const k = p.toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  if (uniq.length === 0) return null;
  const withPin = a.postcode ? [...uniq, a.postcode] : uniq;
  return withPin.join(", ");
}

async function reverseOne(lat: number, lng: number): Promise<string | null> {
  try {
    const res = await fetch(
      `${NOMINATIM}?format=jsonv2&zoom=16&lat=${lat}&lon=${lng}`,
      {
        headers: {
          // Nominatim requires a real identifying agent and returns 403 without
          // one — the same trap that made Overpass fail silently for months.
          "User-Agent": "AgentFarmer/1.0 (https://github.com/agent-farmer)",
        },
        signal: AbortSignal.timeout(8000),
        next: { revalidate: 604800 },
      }
    );
    if (!res.ok) return null;
    const data = await res.json();
    return formatAddress(data?.address);
  } catch {
    return null; // an anchor is an upgrade, never a requirement
  }
}

/**
 * Fill in `address` for shops that lack one, nearest first.
 *
 * Returns a new array; shops that already have an address, and any beyond
 * MAX_LOOKUPS, are passed through untouched. A shop left without an address
 * still works — its link falls back to the coordinate.
 */
export async function addAddresses<T extends { lat: number; lng: number; address: string | null }>(
  stores: T[]
): Promise<T[]> {
  const out = [...stores];
  let used = 0;

  for (let i = 0; i < out.length && used < MAX_LOOKUPS; i++) {
    const s = out[i];
    if (s.address && s.address.trim().length > 0) continue;

    if (used > 0) await sleep(SPACING_MS);
    used++;

    const address = await reverseOne(s.lat, s.lng);
    if (address) out[i] = { ...s, address };
  }

  return out;
}
