/**
 * Builds the curated crop photo pack used by the onboarding recommendation cards.
 *
 * Why a build script rather than a live API call: the cards must show a real
 * photo instantly, offline, with no API key and no per-render lookup. Wikipedia's
 * REST summary endpoint needs no key and returns the article's lead image, which
 * for crops is almost always a usable field or produce photograph.
 *
 * Titles are curated per crop — "Pigeon pea" alone returns a 19th-century
 * botanical plate, so several entries point at a better article. Anything that
 * still looks wrong is meant to be swapped by editing TITLES and re-running.
 *
 * Images are downloaded here, then cropped and compressed by
 * scripts/crop-images.py. Attribution is written to public/images/crops/
 * credits.json — these are Wikimedia files and most carry CC-BY-SA.
 *
 *   node scripts/fetch-crop-images.mjs
 */
import fs from "fs";
import path from "path";

const OUT = path.resolve("public/images/crops/_raw");
fs.mkdirSync(OUT, { recursive: true });

/** agronomy.ts key → Wikipedia article most likely to yield a field photo. */
const TITLES = {
  paddy: "Paddy field",
  wheat: "Wheat",
  maize: "Maize",
  bajra: "Pearl millet",
  jowar: "Sorghum bicolor",
  ragi: "Eleusine coracana",
  groundnut: "Peanut",
  cotton: "Cotton",
  soybean: "Soybean",
  sugarcane: "Sugarcane",
  onion: "Onion",
  tomato: "Tomato",
  potato: "Potato",
  chilli: "Chili pepper",
  mustard: "Mustard plant",
  gram: "Chickpea",
  pigeonpea: "Pigeon pea",
  turmeric: "Turmeric",
  banana: "Banana",
  sunflower: "Sunflower",
  sesame: "Sesame",
  castor: "Ricinus",
  safflower: "Safflower",
  linseed: "Flax",
  niger: "Guizotia abyssinica",
};

const credits = {};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Wikimedia rate-limits hard; retry politely rather than hammering. */
async function get(url, tries = 4) {
  for (let i = 0; i < tries; i++) {
    const r = await fetch(url, {
      headers: { "User-Agent": "agent-farmer/1.0 (educational project)" },
    });
    if (r.status !== 429) return r;
    await sleep(3000 * (i + 1));
  }
  return null;
}

for (const [key, title] of Object.entries(TITLES)) {
  try {
    await sleep(1200); // be a good citizen
    const r = await get(
      `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`
    );
    if (!r || !r.ok) {
      console.log(`${key.padEnd(12)} summary failed ${r ? r.status : "rate-limited"}`);
      continue;
    }
    const j = await r.json();
    const src = j.originalimage?.source ?? j.thumbnail?.source;
    if (!src) {
      console.log(`${key.padEnd(12)} NO IMAGE for "${title}"`);
      continue;
    }

    // Strip tracking params BEFORE deriving the extension — they used to end up
    // in the filename as ".org&utm_campaign=...".
    const clean = src.split("?")[0];
    const url = clean.replace(/\/\d+px-/, "/1280px-");
    const img = await get(url);
    if (!img || !img.ok) {
      console.log(`${key.padEnd(12)} download failed ${img ? img.status : "rate-limited"}`);
      continue;
    }
    const buf = Buffer.from(await img.arrayBuffer());
    const m = clean.toLowerCase().match(/\.(jpe?g|png|webp|gif)$/);
    const ext = m ? m[1] : "jpg";
    fs.writeFileSync(path.join(OUT, `${key}.${ext}`), buf);

    credits[key] = {
      crop: title,
      article: j.content_urls?.desktop?.page ?? `https://en.wikipedia.org/wiki/${encodeURIComponent(title)}`,
      image: clean,
      note: "Wikimedia Commons — check the file page for the exact licence and author.",
    };
    console.log(`${key.padEnd(12)} ok  ${(buf.length / 1024).toFixed(0)}KB  ${ext}`);
  } catch (e) {
    console.log(`${key.padEnd(12)} ERROR ${e.message}`);
  }
}

fs.writeFileSync(
  path.resolve("public/images/crops/credits.json"),
  JSON.stringify(credits, null, 2)
);
console.log(`\n${Object.keys(credits).length}/${Object.keys(TITLES).length} downloaded → ${OUT}`);
