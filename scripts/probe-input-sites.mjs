/**
 * Decides, per agri-ecommerce site, whether the free TinyFish Fetch tier can
 * read its prices or whether a billable browser agent is required.
 *
 * This exists because that question cannot be answered by looking at a site.
 * bighaat.com returns a perfectly good HTML page that says "No products found"
 * — the listing is assembled in the browser — while a plain fetch of
 * agmarknet.gov.in returns 403 and a fetch of myscheme.gov.in returns its
 * footer. Guessing wrong in either direction is expensive: assume Fetch works
 * and the feature silently shows nothing, assume it does not and every lookup
 * bills a browser run it never needed.
 *
 * So each entry in src/lib/inputPrices/sites.ts carries the verdict this script
 * printed, with the date and the numbers behind it, the same way
 * AGENT_BUDGET_SEC in /api/live-mandi carries its two measured runs.
 *
 * Usage:  node scripts/probe-input-sites.mjs [search term]
 *
 * Costs nothing. Search and Fetch are both free tiers; this script never calls
 * the agent.
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
for (const f of [".env.local"]) {
  const p = path.join(ROOT, f);
  if (!fs.existsSync(p)) continue;
  for (const line of fs.readFileSync(p, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}

const KEY = process.env.TINYFISH_API_KEY;
if (!KEY) {
  console.error("TINYFISH_API_KEY is not set (looked in .env.local).");
  process.exit(1);
}

const TERM = process.argv[2] || "urea fertiliser";

/** The candidates. Indian agri-input storefronts that sell to farmers directly. */
const SITES = [
  { id: "bighaat", host: "bighaat.com", label: "BigHaat" },
  { id: "agribegri", host: "agribegri.com", label: "AgriBegri" },
  { id: "iffcobazar", host: "iffcobazar.in", label: "IFFCO Bazar" },
  { id: "kisanekart", host: "kisanekart.in", label: "Kisanekart" },
  { id: "badikheti", host: "badikheti.com", label: "BadiKheti" },
];

const hostOf = (u) => {
  try {
    return new URL(u).host.replace(/^www\./, "");
  } catch {
    return "";
  }
};

/** Rupee amounts as the page prints them. The signal that prices are in the HTML. */
const PRICE_RE = /(?:₹|Rs\.?\s?|INR\s?)\s?\d[\d,]*(?:\.\d{1,2})?/g;

/** Thresholds, matching the ones src/lib/schemeDesk.ts uses for "is this a page". */
const MIN_CHARS = 1200;
const MIN_PRICES = 3;

async function findListing(site) {
  const params = new URLSearchParams({
    query: `${TERM} price buy online ${site.label}`,
    location: "IN",
    language: "en",
    domain_type: "web",
  });
  const res = await fetch(`https://api.search.tinyfish.ai?${params}`, {
    headers: { "X-API-Key": KEY },
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) return null;
  const body = await res.json().catch(() => ({}));
  const hit = (body.results ?? []).find((r) => hostOf(r.url) === site.host);
  return hit?.url ?? null;
}

async function readPage(url) {
  const res = await fetch("https://api.fetch.tinyfish.ai", {
    method: "POST",
    headers: { "X-API-Key": KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ urls: [url], ttl: 0 }),
    signal: AbortSignal.timeout(150_000),
  });
  if (!res.ok) return { error: `http_${res.status}` };
  const body = await res.json().catch(() => ({}));
  const page = (body.results ?? [])[0];
  if (!page) {
    const err = (body.errors ?? [])[0];
    return { error: err ? `${err.error}${err.status ? ` ${err.status}` : ""}` : "no_result" };
  }
  return { chars: page.text?.length ?? 0, prices: (page.text?.match(PRICE_RE) ?? []).length };
}

console.log(`\nProbing ${SITES.length} sites for "${TERM}"  ·  ${new Date().toISOString().slice(0, 10)}\n`);
console.log(`  ${"site".padEnd(14)}${"chars".padStart(8)}${"₹ found".padStart(10)}  verdict   note`);
console.log(`  ${"-".repeat(72)}`);

const verdicts = [];
for (const site of SITES) {
  const url = await findListing(site);
  if (!url) {
    verdicts.push({ ...site, access: "blocked", note: "Search found no listing page on this host" });
    console.log(`  ${site.label.padEnd(14)}${"-".padStart(8)}${"-".padStart(10)}  BLOCKED   search found no listing page`);
    continue;
  }

  const r = await readPage(url);
  if (r.error) {
    verdicts.push({ ...site, access: "blocked", note: `Fetch returned ${r.error}`, url });
    console.log(`  ${site.label.padEnd(14)}${"-".padStart(8)}${"-".padStart(10)}  BLOCKED   fetch: ${r.error}`);
    continue;
  }

  // Readable AND priced means the free tier is enough. Readable but unpriced is
  // the client-rendered case — the page exists, the products do not, and only a
  // real browser will see them.
  const ok = r.chars >= MIN_CHARS && r.prices >= MIN_PRICES;
  const access = ok ? "fetch" : "agent";
  const note = ok
    ? `Fetch read ${r.chars} chars with ${r.prices} rupee amounts`
    : `Fetch read ${r.chars} chars but only ${r.prices} rupee amounts — listing is client-rendered`;
  verdicts.push({ ...site, access, note, url });
  console.log(
    `  ${site.label.padEnd(14)}${String(r.chars).padStart(8)}${String(r.prices).padStart(10)}  ${access === "fetch" ? "FETCH  " : "AGENT  "}   ${ok ? "prices are in the HTML" : "prices load in the browser"}`
  );
}

console.log(`\n  Paste into src/lib/inputPrices/sites.ts:\n`);
const today = new Date().toISOString().slice(0, 10);
for (const v of verdicts) {
  console.log(
    `  { id: ${JSON.stringify(v.id)}, host: ${JSON.stringify(v.host)}, label: ${JSON.stringify(v.label)},\n` +
      `    access: ${JSON.stringify(v.access)}, searchHint: ${JSON.stringify(v.label)},\n` +
      `    probedOn: ${JSON.stringify(today)}, note: ${JSON.stringify(v.note)} },`
  );
}
console.log();
