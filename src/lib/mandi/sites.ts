import { slug } from "@/lib/tinyfish";

/**
 * Where cross-mandi prices come from, and which tier each source needs.
 *
 * Every verdict below is a measurement taken on 2026-10-20 against the live
 * sites, not a reading of their HTML. The same discipline as
 * src/lib/inputPrices/sites.ts: no source's tier is guessed, and each entry
 * carries the number that decided it.
 *
 * ── What replaced Agmarknet, and why ─────────────────────────────────────────
 *
 * /api/live-mandi used to drive a browser agent at agmarknet.gov.in. Two real
 * runs (17 steps/89 s and 33 steps/166 s) both completed and both returned
 * `{"mandis": []}`: the site is a React SPA whose prices sit behind a guest-OTP
 * login, so the agent reaches it and still cannot read a price. Plain Fetch
 * gets `target_http_error` 403. It is a dead end at every tier and is not
 * listed here.
 */

export type MandiAccess = "fetch" | "agent" | "blocked";

export type MandiSite = {
  id: string;
  host: string;
  label: string;
  access: MandiAccess;
  probedOn: string;
  /** The measurement that decided `access`, verbatim. */
  note: string;
};

/**
 * MandiPulse state pages are the spine of this feature, and the clearest
 * free-versus-paid comparison in the app.
 *
 * Free Fetch reads /mandi-bhav/karnataka/tomato in 208 ms and returns the whole
 * summary (range, average, median, 14 reporting mandis, 10 districts) plus
 * every row's minimum, modal and maximum price — but the markdown it produces
 * drops the mandi-name column, so row 1 reads "Mysuru" (the district) where
 * "Nanjangud APMC" should be. Prices without the name of the market that
 * quoted them are not actionable: a farmer cannot drive to a district.
 *
 * A browser run against the identical URL (e845d924-6720-4bbb-bcf2-8db2ccf52dc5)
 * returned all 14 rows with names intact — Nanjangud APMC ₹4,166, Bangarpet
 * APMC ₹800 — and its prices match the free read row for row. That agreement is
 * what `live.ts` uses as a validator: an agent row whose modal price is absent
 * from the free markdown is dropped.
 */
export const MANDI_SITES: MandiSite[] = [
  {
    id: "mandipulse",
    host: "mandipulse.com",
    label: "MandiPulse",
    access: "agent",
    probedOn: "2026-10-20",
    note:
      "Fetch read the state page in 208 ms with the full price table and summary, " +
      "but the mandi-name column is lost in rendering. A browser run on the same " +
      "URL returned all 14 names with matching prices.",
  },
  {
    id: "acrop",
    host: "acrop.app",
    label: "ACROP",
    access: "fetch",
    probedOn: "2026-10-20",
    note:
      "Fetch read the state roll-up: median ₹1,650/quintal across 13 mandis, " +
      "lowest Bangarpet APMC ₹800, highest Nanjangud APMC ₹4,166, plus 30 days of history.",
  },
  {
    id: "vegmarket",
    host: "vegetablemarketprice.com",
    label: "Vegetable Market Price",
    access: "fetch",
    probedOn: "2026-10-20",
    note:
      "Fetch read 54 vegetables for the state with both wholesale and retail ₹/kg " +
      "and today's date. The only retail source here; everything else is wholesale.",
  },
  {
    // Works, and is still not used at runtime. Worth recording precisely
    // because "we measured it, it succeeded, and we declined it" is a real
    // engineering decision and the reasoning is otherwise invisible.
    id: "commodityonline",
    host: "commodityonline.com",
    label: "Commodity Online",
    access: "blocked",
    probedOn: "2026-10-20",
    note:
      "Fetch is bot_blocked. A browser run did succeed (14 steps, 116 s, $0.224) " +
      "and returned 10 mandis — but the figures were identical to MandiPulse's, " +
      "at 4.6x the cost and past the 60 s function ceiling. Declined on price, not capability.",
  },
  {
    id: "acrop-state-districts",
    host: "acrop.app",
    label: "ACROP district cards",
    access: "blocked",
    probedOn: "2026-10-20",
    note:
      "The state page's district cards defeated both tiers: Fetch saw headings with " +
      "no rows, and a browser run returned {\"districts\": []}. The district pages " +
      "themselves read fine (3 steps, 36 s, all 9 Kolar mandis), so this is one page, not the site.",
  },
  {
    id: "napanta",
    host: "napanta.com",
    label: "Napanta",
    access: "blocked",
    probedOn: "2026-10-20",
    note: "Fetch is bot_blocked. Not probed with a browser: MandiPulse already covers the same AgMarkNet rows.",
  },
  {
    id: "kisandeals",
    host: "kisandeals.com",
    label: "KisanDeals",
    access: "blocked",
    probedOn: "2026-10-20",
    note: "Fetch returns target_http_error 403. Same coverage as MandiPulse, so not worth a browser run.",
  },
  {
    id: "hellokisaan",
    host: "hellokisaan.com",
    label: "HelloKisaan",
    access: "blocked",
    probedOn: "2026-10-20",
    note:
      "Renders to Fetch, but every price on the Bangalore APMC tomato page was ₹0 " +
      "while other sources showed real rates. Placeholder data is worse than none.",
  },
  {
    id: "enam",
    host: "enam.gov.in",
    label: "e-NAM",
    access: "blocked",
    probedOn: "2026-10-20",
    note: "The trade-data dashboard returns navigation chrome and no prices — an SPA, the same shape as agmarknet.",
  },
];

export function siteById(id: string): MandiSite | undefined {
  return MANDI_SITES.find((s) => s.id === id);
}

/**
 * State slugs.
 *
 * All three live sources happen to use the same lowercase-hyphenated form, so
 * one slug serves all of them. Checked against Karnataka, Uttar Pradesh,
 * Andhra Pradesh and West Bengal in Search results.
 */
export function stateSlug(state: string): string {
  return slug(state);
}

export function cropSlug(crop: string): string {
  return slug(crop);
}

export function mandipulseUrl(crop: string, state: string): string {
  return `https://mandipulse.com/mandi-bhav/${stateSlug(state)}/${cropSlug(crop)}`;
}

export function acropUrl(crop: string, state: string): string {
  return `https://acrop.app/prices/${cropSlug(crop)}/${stateSlug(state)}`;
}

export function retailUrl(state: string): string {
  return `https://vegetablemarketprice.com/market/${stateSlug(state)}/today`;
}
