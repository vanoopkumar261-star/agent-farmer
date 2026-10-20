/**
 * Re-checks, per mandi-price site, what the free TinyFish Fetch tier can
 * actually read — and in particular whether it recovers the mandi NAMES.
 *
 * This is the sibling of probe-input-sites.mjs, and it exists because the
 * interesting failure here is subtler than "blocked" or "empty". MandiPulse's
 * state page returns its whole price table to a free fetch in about 200 ms and
 * still loses the mandi-name column in rendering: fourteen rows of real prices
 * attached to nothing a farmer can drive to. A page that looks like a success
 * by character count can be a failure by usefulness.
 *
 * The verdicts in src/lib/mandi/sites.ts came from these checks on 2026-10-20.
 * Re-run before relying on them: these are live third-party pages and any of
 * them can change shape overnight.
 *
 * Usage:  node scripts/probe-mandi-sites.mjs [crop] [state]
 *
 * Costs nothing. Search and Fetch are free tiers; this script never starts a
 * browser run. Where it prints AGENT it is reporting that the free tier came
 * up short, not that a browser has been tried and worked.
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

// Accepts either the pool or the single-key fallback, same as the app.
const KEY = (process.env.TINYFISH_API_KEYS || process.env.TINYFISH_API_KEY || "")
  .split(",")[0]
  .trim();
if (!KEY) {
  console.error("No TinyFish key set (looked for TINYFISH_API_KEYS / TINYFISH_API_KEY in .env.local).");
  process.exit(1);
}

const CROP = process.argv[2] || "Tomato";
const STATE = process.argv[3] || "Karnataka";
const slug = (s) => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

/** A readable page needs this much text before it is worth parsing at all. */
const MIN_CHARS = 1200;
/** Below this many rupee figures, the page is chrome rather than a price table. */
const MIN_PRICES = 3;
/** Below this many *named* priced rows, the prices are not actionable. */
const MIN_NAMES = 3;

/**
 * Each target is judged by what it is for, not by one generic rule.
 *
 *   mandi-table — must yield named mandis beside their own prices
 *   rollup      — a state summary; a named high and low is enough
 *   retail      — a per-kg shop list, which has no mandi names by design
 *
 * A single shared rule produced confidently wrong answers on the first version
 * of this script: it passed MandiPulse because three mandi names appear in its
 * prose, passed HelloKisaan because the page embeds a <select> of all 191
 * Karnataka APMCs while every rate on it is zero, and failed the retail list
 * for not containing mandi names it was never supposed to have.
 */
const TARGETS = [
  { id: "mandipulse", kind: "mandi-table", url: `https://mandipulse.com/mandi-bhav/${slug(STATE)}/${slug(CROP)}` },
  { id: "acrop", kind: "rollup", url: `https://acrop.app/prices/${slug(CROP)}/${slug(STATE)}` },
  { id: "vegmarket", kind: "retail", url: `https://vegetablemarketprice.com/market/${slug(STATE)}/today` },
  { id: "commodityonline", kind: "mandi-table", url: `https://www.commodityonline.com/mandiprices/${slug(CROP)}/${slug(STATE)}` },
  { id: "napanta", kind: "mandi-table", url: `https://www.napanta.com/market-price/${slug(STATE)}` },
  { id: "kisandeals", kind: "mandi-table", url: `https://www.kisandeals.com/mandiprices/${CROP.toUpperCase()}/${STATE.toUpperCase()}` },
  { id: "hellokisaan", kind: "mandi-table", url: `https://hellokisaan.com/mandirates/${slug(STATE)}/bangalore/${slug(CROP)}` },
  { id: "enam", kind: "mandi-table", url: "https://enam.gov.in/web/dashboard/trade-data" },
];

const res = await fetch("https://api.fetch.tinyfish.ai", {
  method: "POST",
  headers: { "X-API-Key": KEY, "Content-Type": "application/json" },
  body: JSON.stringify({ urls: TARGETS.map((t) => t.url), ttl: 0 }),
  signal: AbortSignal.timeout(150_000),
});

if (!res.ok) {
  console.error(`Fetch API returned HTTP ${res.status}`);
  process.exit(1);
}

const body = await res.json();
const pages = new Map((body.results ?? []).map((r) => [r.url, r]));
const errors = new Map((body.errors ?? []).map((e) => [e.url, e]));

/** Market names as these pages write them: "Nanjangud APMC", "Binny Mill (F&V)". */
const NAME_RE = /\b([A-Z][A-Za-z.()&' ]{2,38}?(?:APMC|Mandi|Market))\b/g;
const PRICE_RE = /₹\s?(\d[\d,]*)/g;

function priceValues(text) {
  return [...text.matchAll(PRICE_RE)].map((m) => Number(m[1].replace(/,/g, "")));
}

/**
 * Mandi names that sit in a table row carrying a price.
 *
 * Names in prose, in navigation, or in a dropdown of every market in the state
 * do not make a page usable — only a name beside its own number does.
 */
function namesInPricedRows(text) {
  const found = new Set();
  for (const line of text.split("\n")) {
    if (!line.includes("|") || !line.includes("₹")) continue;
    for (const m of line.matchAll(NAME_RE)) found.add(m[1].trim());
  }
  return found;
}

const rows = [];
for (const t of TARGETS) {
  const page = pages.get(t.url);
  const err = errors.get(t.url);

  if (!page) {
    rows.push({ ...t, verdict: "BLOCKED", chars: 0, prices: 0, names: 0, note: err?.error ?? "no result" });
    continue;
  }

  const text = page.text ?? "";
  const values = priceValues(text);
  const nonZero = values.filter((v) => v > 0);
  const names = namesInPricedRows(text);

  let verdict;
  let note;

  if (text.length < MIN_CHARS || values.length < MIN_PRICES) {
    verdict = "BLOCKED";
    note = `only ${text.length} chars / ${values.length} prices — chrome, not a price table`;
  } else if (nonZero.length === 0) {
    // Observed on hellokisaan: a complete-looking page where every rate is ₹0.
    // Placeholder data is worse than none, because it looks real.
    verdict = "BLOCKED";
    note = `${values.length} price figures and every one is ₹0 — placeholder data`;
  } else if (t.kind === "retail") {
    const hasCrop = new RegExp(`\\|\\s*${CROP}\\s*\\|`, "i").test(text);
    verdict = hasCrop ? "FETCH" : "BLOCKED";
    note = hasCrop
      ? `retail list carries ${CROP}, ${nonZero.length} per-kg figures`
      : `retail list does not carry ${CROP}`;
  } else if (t.kind === "rollup") {
    const named = /recorded the (highest|lowest)|Lowest mandi modal price/.test(text);
    verdict = named ? "FETCH" : "AGENT";
    note = named
      ? `roll-up with the named high and low, ${nonZero.length} figures`
      : `${nonZero.length} figures but no named high or low`;
  } else if (names.size < MIN_NAMES) {
    verdict = "AGENT";
    note = `${nonZero.length} priced rows but only ${names.size} carry a name — the name column is lost in rendering`;
  } else {
    verdict = "FETCH";
    note = `${nonZero.length} prices and ${names.size} named mandis in priced rows`;
  }

  rows.push({ ...t, verdict, chars: text.length, prices: nonZero.length, names: names.size, note });
}

const today = new Date().toISOString().slice(0, 10);
console.log(`\nTinyFish Fetch probe — ${CROP} / ${STATE} — ${today}\n`);
console.log(`  ${"site".padEnd(16)} ${"kind".padEnd(12)} ${"verdict".padEnd(8)} ${"chars".padStart(7)} ${"₹>0".padStart(5)} ${"named".padStart(6)}  note`);
console.log(`  ${"-".repeat(16)} ${"-".repeat(12)} ${"-".repeat(8)} ${"-".repeat(7)} ${"-".repeat(5)} ${"-".repeat(6)}  ${"-".repeat(44)}`);
for (const r of rows) {
  console.log(
    `  ${r.id.padEnd(16)} ${r.kind.padEnd(12)} ${r.verdict.padEnd(8)} ${String(r.chars).padStart(7)} ${String(r.prices).padStart(5)} ${String(r.names).padStart(6)}  ${r.note}`
  );
}

console.log(`\nPaste-ready access values for src/lib/mandi/sites.ts:\n`);
for (const r of rows) {
  console.log(`  ${r.id}: access: "${r.verdict.toLowerCase()}",  // ${today} — ${r.note}`);
}
console.log(
  `\nAGENT means the free tier fell short, not that a browser was tried and worked.\n` +
    `Confirm with one capped run before trusting it: myscheme.gov.in and\n` +
    `agmarknet.gov.in both defeated the browser too, and shipping a paid rung that\n` +
    `returns nothing is the mistake this project already made once.\n`
);
