/**
 * Warm the mandi geocache.
 *
 * The market board needs the real road distance from the farmer to each mandi, but
 * geocoding mandis inline on the request path is unsafe (Nominatim allows ~1 req/s;
 * Vercel functions time out at ~10s). So coordinates live in `mandi_geocache`
 * (migration 008) and the request path only reads them. This script fills that
 * cache ahead of time: it pulls today's AGMARKNET mandis per state and geocodes the
 * ones not already cached, at a polite rate.
 *
 * Run it on a full-feed day (afternoon/evening IST, when mandis have reported), or
 * on a schedule. Safe to re-run — cached mandis are skipped.
 *
 *   npx tsx scripts/warm-mandi-geocache.mts Punjab Maharashtra
 *   npx tsx scripts/warm-mandi-geocache.mts        # a default spread of states
 */
import fs from "fs";

// Local runs read .env.local; CI (the daily GitHub Action) sets these as env
// from repo secrets, so the file is optional.
if (fs.existsSync(".env.local")) {
  for (const line of fs.readFileSync(".env.local", "utf8").split("\n")) {
    const i = line.indexOf("=");
    if (i < 0 || line.startsWith("#")) continue;
    const k = line.slice(0, i).trim();
    const v = line.slice(i + 1).trim().replace(/^["']|["']$/g, "");
    if (k && !process.env[k]) process.env[k] = v;
  }
}

const { mandiCoords } = await import("../src/lib/mandi/distance");

const KEY = process.env.DATA_GOV_API_KEY;
const RESOURCE = "9ef84268-d588-465a-a308-a864a43d0070";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const DEFAULT_STATES = [
  "Punjab", "Haryana", "Uttar Pradesh", "Maharashtra", "Karnataka", "Gujarat",
  "Madhya Pradesh", "Rajasthan", "Andhra Pradesh", "Telangana", "Tamil Nadu", "West Bengal",
];
const states = process.argv.slice(2);
const STATES = states.length ? states : DEFAULT_STATES;

async function mandisFor(state: string): Promise<Array<{ market: string; district: string }>> {
  const url =
    `https://api.data.gov.in/resource/${RESOURCE}?api-key=${KEY}&format=json&limit=2000` +
    `&filters%5Bstate.keyword%5D=${encodeURIComponent(state)}`;
  const j = (await (await fetch(url)).json()) as { records?: Array<{ market: string; district: string }> };
  const seen = new Map<string, { market: string; district: string }>();
  for (const r of j.records ?? []) {
    const key = `${r.market}|${r.district}`;
    if (!seen.has(key)) seen.set(key, { market: r.market, district: r.district });
  }
  return [...seen.values()];
}

let total = 0;
let fresh = 0;
for (const state of STATES) {
  const mandis = await mandisFor(state);
  console.log(`\n${state}: ${mandis.length} mandi(s) in today's feed`);
  for (const m of mandis) {
    total++;
    const t0 = Date.now();
    const c = await mandiCoords(m.market, m.district, state);
    const took = Date.now() - t0;
    console.log(`  ${m.market} / ${m.district}: ${c ? `${c.lat.toFixed(3)},${c.lon.toFixed(3)}` : "not located"}`);
    if (took > 400) {
      fresh++;
      await sleep(1100); // only pace real (uncached) geocodes — respect Nominatim ~1/s
    }
  }
}
console.log(`\nDone: ${total} mandi(s) seen across ${STATES.length} state(s), ~${fresh} freshly geocoded.`);
