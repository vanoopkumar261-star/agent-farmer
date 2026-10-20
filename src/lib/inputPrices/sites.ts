/**
 * Which Indian agri-input storefronts we read, and how.
 *
 * Every `access` value here was produced by `node scripts/probe-input-sites.mjs`
 * and is pasted with the measurement that decided it. None of them is a guess,
 * because the guess is not safe in either direction: treat a client-rendered
 * store as readable and the feature silently shows nothing, treat a readable
 * store as client-rendered and every lookup bills a browser run it never needed.
 *
 * Re-run the probe when a site redesigns. A verdict with an old `probedOn` is a
 * claim about a page that may no longer exist.
 */
export type InputSite = {
  id: string;
  host: string;
  label: string;
  /**
   * "fetch"   — prices are in the HTML; the free tier is enough.
   * "agent"   — the page loads but its listing is assembled in the browser.
   * "blocked" — we cannot get a listing page at all. Never called at runtime.
   */
  access: "fetch" | "agent" | "blocked";
  /** Appended to the search query to bias results toward this site. */
  searchHint: string;
  probedOn: string;
  /** The measurement, verbatim from the probe. */
  note: string;
};

export const INPUT_SITES: InputSite[] = [
  {
    id: "agribegri",
    host: "agribegri.com",
    label: "AgriBegri",
    access: "fetch",
    searchHint: "AgriBegri",
    probedOn: "2026-10-20",
    note: "Fetch read 13198 chars with 240 rupee amounts",
  },
  {
    id: "bighaat",
    host: "bighaat.com",
    label: "BigHaat",
    access: "agent",
    searchHint: "BigHaat",
    probedOn: "2026-10-20",
    // Confirmed in both directions, which is why this site is the one the agent
    // rung targets first: Fetch reads the page and finds no products, and a
    // browser run against the identical URL returned five real ones with prices
    // and working links (run 56796963-b2e8-43b5-977b-8878d97f927f).
    note: "Fetch read 1449 chars but only 0 rupee amounts — listing is client-rendered",
  },
  {
    id: "badikheti",
    host: "badikheti.com",
    label: "BadiKheti",
    access: "agent",
    searchHint: "BadiKheti",
    probedOn: "2026-10-20",
    note: "Fetch read 5060 chars but only 2 rupee amounts — listing is client-rendered",
  },
  {
    id: "iffcobazar",
    host: "iffcobazar.in",
    label: "IFFCO Bazar",
    access: "blocked",
    searchHint: "IFFCO Bazar",
    probedOn: "2026-10-20",
    note: "Search found no listing page on this host",
  },
  {
    id: "kisanekart",
    host: "kisanekart.in",
    label: "Kisanekart",
    access: "blocked",
    searchHint: "Kisanekart",
    probedOn: "2026-10-20",
    note: "Search found no listing page on this host",
  },
];

export const siteById = (id: string): InputSite | undefined =>
  INPUT_SITES.find((s) => s.id === id);
