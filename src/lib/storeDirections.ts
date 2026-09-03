/**
 * The Google Maps link behind every "Directions" button.
 *
 * ── The complaint ───────────────────────────────────────────────────────────
 * Tapping "Roots and Shoots — Garden Centre" opened a Google Maps page titled
 * "GLAMUP UNISEX SALON". That looks like the locator sending farmers to random
 * places, so it was worth measuring rather than assuming. Against Google's own
 * record for that shop our pin is 22 m out — the right building. The link was
 * sending `destination=<lat>,<lng>`, a bare coordinate, and Google labels a
 * bare coordinate with the nearest business it has indexed. Right place,
 * neighbour's name.
 *
 * ── Why the obvious fix is worse than the bug ───────────────────────────────
 * Sending the shop's name instead makes Google resolve it, and Google resolves
 * a name against the *searcher's* location, not the shop's. Measured:
 *
 *   destination=Ambika Electrical
 *     → an Ambika Electricals in Bengaluru, 400 km away.
 *
 * Appending a reverse-geocoded address fixes that case — and still is not
 * enough, because Google fuzzy-matches a name it does not have onto one it
 * does, without saying so:
 *
 *   Ambika Electrical, Mayura Road, Sirsi, …      →  3 m.     correct
 *   Roots and Shoots, Saptapur Road, Dharwad, …   →  22 m.    correct
 *   Hulagola Seva Sahakari Sangha, Hulagola, …    →  15.9 km. WRONG —
 *     silently substituted "Hitlalli Seva Sahakari Sangha", a different
 *     cooperative in a different village.
 *
 * Cooperative societies, "krishi kendra" and hardware shops all share highly
 * generic names across rural India, so that third case is not exotic.
 *
 * ── The rule this file follows ──────────────────────────────────────────────
 * A wrong label costs a farmer a moment of confusion. A wrong position costs
 * them the trip. So a name is sent to Google only when Google itself supplied
 * the identifier and the match cannot drift — never on a name we merely hope
 * it recognises.
 *
 *   Places tier → place_id. Unambiguous by construction.
 *   OSM tier    → coordinate. Exact position; the pin may borrow a
 *                 neighbour's name, which the address on the card explains.
 *
 * The fix for the borrowed label is not a cleverer query string, it is the
 * Places tier: shops that come from Google's index carry Google's own id.
 * That needs GOOGLE_MAPS_API_KEY set.
 *
 * (One lead, deliberately not acted on: both correct resolutions above had a
 * postcode in the address and the wrong one did not. Three samples is not a
 * rule, and the failure is silent and expensive, so it is not worth guessing.)
 */

export type DirectionsTarget = {
  name: string;
  lat: number;
  lng: number;
  address?: string | null;
  /** Google's own place identifier, present only on the Places tier. */
  placeId?: string | null;
};

const BASE = "https://www.google.com/maps/dir/?api=1";

export function directionsUrl(s: DirectionsTarget): string {
  // Google's own id: `destination` must still carry text (the API requires it),
  // but destination_place_id is what resolves, so the text cannot misdirect.
  if (s.placeId) {
    const text = s.address ? `${s.name}, ${s.address}` : s.name;
    return (
      `${BASE}&destination=${encodeURIComponent(text)}` +
      `&destination_place_id=${encodeURIComponent(s.placeId)}`
    );
  }

  // Everything else: the coordinate. Never the name — see the note above.
  return `${BASE}&destination=${s.lat},${s.lng}`;
}
