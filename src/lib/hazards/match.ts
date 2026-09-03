import { extractStateFromAddress } from "../market";
import type { HazardSeverity } from "./types";

/**
 * Deciding whether an official warning covers a particular farmer.
 *
 * SACHET's polygon endpoint returns 403 to any client we can be, so there is no
 * geometry to test a point against. The only geographic information a warning
 * carries is the district names written into its headline, in free text, by
 * whichever regional office issued it. This module does that matching, and its
 * guiding principle is asymmetric:
 *
 *   A missed warning is a warning the farmer gets from radio, TV or a neighbour.
 *   A false warning is one the farmer acts on — abandoning a harvest, spending a
 *   day draining a field — for a storm that was never over his land. He will not
 *   make that mistake twice, and after it he stops reading our alerts at all.
 *
 * So every rule here is tuned to under-match rather than over-match.
 */

/** IMD's own warning colours, which Indian farmers already recognise. */
export type HazardBand = "red" | "orange" | "yellow";

/**
 * CAP severity/urgency mapped onto IMD's green/yellow/orange/red scale.
 *
 * Deliberately mirrors IMD rather than inventing a scale: the farmer may well
 * hear "orange alert" on the radio for the same event, and the app disagreeing
 * with the bulletin would be worse than saying nothing.
 *
 * `urgency: "Immediate"` promotes to red on its own. Observed in the live feed:
 * "Extremely Heavy Rain (Greater than 204.5 mm)" carries urgency Immediate,
 * and that is a take-action warning whatever its severity field says.
 */
export function bandFor(severity: HazardSeverity, urgency?: string): HazardBand {
  if (severity === "Extreme" || urgency === "Immediate") return "red";
  if (severity === "Severe") return "orange";
  return "yellow";
}

/** Red and orange are the "emergency or high" alerts; yellow is context. */
export function isHighAlert(band: HazardBand): boolean {
  return band === "red" || band === "orange";
}

/**
 * Fold to a comparable form: lowercase, strip diacritics, collapse anything
 * that is not a letter or digit to a single space.
 *
 * Punctuation becomes a separator rather than being deleted, which is what
 * makes the slash-separated lists these headlines use ("Bhopal/Bairagarh",
 * "Vidisha/Udayagiri", "Panna/TR") split into real tokens instead of fusing
 * into one unmatchable word.
 */
export function normalise(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Whole-word containment: is `needle` present in `haystack` as complete words?
 *
 * Both sides are normalised first, then the needle is looked for with space
 * boundaries. This is what stops a district whose name is a prefix of another
 * from matching it — "Bid" must not match "Bidar", "Bali" must not match
 * "Balikuda". A substring test would fire on both and quietly send the wrong
 * farmers an alert.
 */
export function containsWholeWord(haystack: string, needle: string): boolean {
  const h = normalise(haystack);
  const n = normalise(needle);
  if (!h || !n) return false;
  return ` ${h} `.includes(` ${n} `);
}

/**
 * The farmer's district, read out of the address already stored on their
 * profile. Nominatim's display_name is comma-separated and ordered
 * narrowest-to-widest, with the district immediately before the state:
 *
 *   "580021, Hubballi Urban Taluku, Dharwad, Karnataka, India"
 *                                   ^^^^^^^  ^^^^^^^^^
 *   "Azad Market, Ibrahimpura, Bhopal, Huzur Tahsil, Bhopal, Madhya Pradesh, 462001"
 *                                                    ^^^^^^  ^^^^^^^^^^^^^^
 *
 * Note the second example: "Bhopal" also appears earlier as the city. Scanning
 * forward for the state and stepping back one component picks the
 * administrative district rather than the first plausible-looking word, which
 * is why this walks the components instead of pattern-matching the string.
 *
 * Reuses `extractStateFromAddress` from market.ts as the state authority so the
 * app has one list of Indian states, not two that can drift.
 */
export function districtFromAddress(
  address: string | null | undefined
): { district: string; state: string } | null {
  if (!address) return null;

  const state = extractStateFromAddress(address);
  if (!state) return null;

  const parts = address
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);

  const stateIdx = parts.findIndex((p) => normalise(p) === normalise(state));
  if (stateIdx < 1) return null;

  // Step back over anything that is not a place name — a PIN code, or the
  // literal "India" if the ordering is unusual.
  for (let i = stateIdx - 1; i >= 0; i--) {
    const candidate = parts[i];
    if (/^\d+$/.test(candidate)) continue;
    if (normalise(candidate) === "india") continue;
    if (normalise(candidate).length < 3) continue;
    return { district: candidate, state };
  }
  return null;
}

/**
 * The text of a warning that describes *where* it applies.
 *
 * Critically this is the headline and area description ONLY — never `sender`.
 * Senders are named after the office that issued them ("IMD Bhopal", "IMD
 * Kolkata"), so including the sender would match a Bhopal farmer against every
 * alert IMD Bhopal has ever issued, for any district in Madhya Pradesh. On the
 * live feed that is 11 alerts matched where 1 is correct.
 */
function areaText(alert: Locatable): string {
  const areaDesc =
    alert.raw && typeof alert.raw.areaDesc === "string" ? alert.raw.areaDesc : "";
  return `${alert.headline} ${areaDesc}`;
}

/**
 * The minimum an alert must expose to be located.
 *
 * `raw` is nullable rather than optional because that is how it comes back from
 * Postgres; accepting both shapes keeps callers from casting a database row.
 */
export type Locatable = {
  headline: string;
  raw?: Record<string, unknown> | null;
};

/** Does this warning name the farmer's district? */
export function coversDistrict(alert: Locatable, district: string): boolean {
  return containsWholeWord(areaText(alert), district);
}

/**
 * Does this warning name the farmer's state?
 *
 * Used only to widen the net for red alerts. A state-level match on an ordinary
 * warning would tell a farmer in Hubballi about a thunderstorm 500 km away in
 * Belagavi, which is exactly the noise that trains people to ignore alerts. For
 * a take-action warning the trade-off flips and it is worth showing.
 */
export function coversState(alert: Locatable, state: string): boolean {
  return containsWholeWord(areaText(alert), state);
}
