/**
 * Builds the soil-type and irrigation photo packs for the onboarding picker.
 *
 * Same reasoning as scripts/fetch-crop-images.mjs: the cards must show a real
 * photograph instantly, offline, with no API key and no per-render lookup, so
 * images are fetched once at build time and committed. Resize/convert happens
 * inline via sharp, so there is no separate Python pass.
 *
 * ── Why each slot names its own source ───────────────────────────────────────
 * The crop pack takes each Wikipedia article's lead image, which works because
 * an article about wheat opens with a photograph of wheat. Soil and irrigation
 * do not behave that way, and two earlier attempts proved it concretely:
 *
 *   article lead  → Vertisol gave a world distribution map, Laterite gave a
 *                   stone monument plaque, "Irrigation canal" gave a harbour
 *                   at dusk. Seven of nine unusable.
 *   plain search  → postage stamps, a 1915 book scan, a derelict building.
 *
 * Commons *categories* are curated by subject and reliably contain photographs,
 * so they are preferred. Where no category exists the slot falls back to a
 * short search phrase or a known-good article. The lesson worth keeping: these
 * cannot be judged by filename, which is how a map of the world nearly shipped
 * as a soil sample. Candidates are written to _candidates/ to be looked at.
 *
 *   node scripts/fetch-field-images.mjs            # fetch candidates to review
 *   node scripts/fetch-field-images.mjs --promote  # copy CHOSEN into place
 */
import fs from "fs";
import path from "path";
import sharp from "sharp";

/** `cat:` a Commons category · `search:` a Commons file search · `article:` a Wikipedia lead image. */
const SETS = {
  // Soil is NOT fetched. Three sourcing passes produced micrographs, a world
  // distribution map, a stone monument and geology specimens — soil articles
  // are written about taxonomy, not about what a field looks like. The five
  // soil cards are drawn instead, in src/components/onboarding/SoilSwatch.tsx,
  // where the colour and the crack pattern can be made accurate on purpose.
  irrigation: {
    borewell: "cat:Category:Tube wells",
    canal: "cat:Category:Irrigation canals in India",
    river: "search:river water pump irrigation field",
    rainfed: "cat:Category:Dryland farming",
    drip: "article:Drip irrigation",
    sprinkler: "article:Irrigation sprinkler",
  },
};

/** Reviewed pick per slot, 1-based index into the candidate sheet. */
const CHOSEN = {
  // Reviewed by eye on a contact sheet, not by filename:
  //   borewell 3 = a hand pump standing in a field (1 is a dark shaft, 4 is
  //                a group of people, which is not what this card is about)
  //   canal    1 = Bhakra Main Canal, unmistakable at thumbnail size
  //   rainfed  4 = a dry ploughed field (2 is lush wheat, which contradicts
  //                the label; 3 is badlands, which reads as desert)
  //   river      = handled separately below — the category is full of maps
  irrigation: { borewell: 3, canal: 1, river: 1, rainfed: 4, drip: 1, sprinkler: 1 },
};

const CANDIDATES_PER_SLOT = 4;
const TARGET_W = 640;
const TARGET_H = 400;
const promote = process.argv.includes("--promote");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const API = "https://commons.wikimedia.org/w/api.php";

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

/** Photographs only — Commons is full of maps, diagrams and SVG schematics. */
function usable(info) {
  const w = info?.width ?? 0;
  const h = info?.height ?? 0;
  if (!/^image\/(jpeg|png|webp)$/.test(info?.mime ?? "")) return false;
  if (w < 640 || h < 400) return false;
  const ratio = w / h;
  return ratio > 0.8 && ratio < 3.2;
}

/** Turn a list of Commons file titles into downloadable image info. */
async function infoFor(titles) {
  if (titles.length === 0) return [];
  const r = await get(
    `${API}?action=query&format=json&prop=imageinfo&iiprop=url|mime|size` +
      `&iiurlwidth=1280&titles=${encodeURIComponent(titles.join("|"))}`
  );
  if (!r || !r.ok) return [];
  const j = await r.json();
  return Object.values(j.query?.pages ?? {})
    .map((p) => ({ title: p.title, info: p.imageinfo?.[0] }))
    .filter((c) => usable(c.info));
}

async function candidatesFor(spec) {
  const [kind, ...rest] = spec.split(":");
  const arg = rest.join(":");

  if (kind === "cat") {
    const r = await get(
      `${API}?action=query&format=json&list=categorymembers&cmtype=file&cmlimit=20` +
        `&cmtitle=${encodeURIComponent(arg)}`
    );
    if (!r || !r.ok) return [];
    const j = await r.json();
    return infoFor((j.query?.categorymembers ?? []).map((m) => m.title));
  }

  if (kind === "search") {
    const r = await get(
      `${API}?action=query&format=json&generator=search&gsrnamespace=6&gsrlimit=20` +
        `&gsrsearch=${encodeURIComponent(arg)}&prop=imageinfo` +
        "&iiprop=url|mime|size&iiurlwidth=1280"
    );
    if (!r || !r.ok) return [];
    const j = await r.json();
    return Object.values(j.query?.pages ?? {})
      .map((p) => ({ title: p.title, info: p.imageinfo?.[0] }))
      .filter((c) => usable(c.info));
  }

  // article: the crop-pack approach, kept for the two slots where it works.
  const r = await get(
    `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(arg)}`
  );
  if (!r || !r.ok) return [];
  const j = await r.json();
  const src = j.originalimage?.source ?? j.thumbnail?.source;
  if (!src) return [];
  const clean = src.split("?")[0];
  return [
    {
      title: arg,
      info: {
        url: clean,
        thumburl: clean.replace(/\/\d+px-/, "/1280px-"),
        descriptionurl: j.content_urls?.desktop?.page,
      },
    },
  ];
}

for (const [set, specs] of Object.entries(SETS)) {
  const outDir = path.resolve(`public/images/${set}`);
  const candDir = path.join(outDir, "_candidates");
  fs.mkdirSync(promote ? outDir : candDir, { recursive: true });
  const creditsPath = path.join(outDir, "credits.json");
  const credits = fs.existsSync(creditsPath)
    ? JSON.parse(fs.readFileSync(creditsPath, "utf8"))
    : {};

  console.log(`\n=== ${set} ===`);
  for (const [key, spec] of Object.entries(specs)) {
    try {
      await sleep(800);
      const found = await candidatesFor(spec);
      if (found.length === 0) {
        console.log(`  ${key.padEnd(11)} NO CANDIDATES for ${spec}`);
        continue;
      }
      const wanted = promote
        ? [found[(CHOSEN[set]?.[key] ?? 1) - 1]].filter(Boolean)
        : found.slice(0, CANDIDATES_PER_SLOT);

      for (let i = 0; i < wanted.length; i++) {
        const c = wanted[i];
        const img = await get(c.info.thumburl ?? c.info.url);
        if (!img || !img.ok) continue;
        const out = await sharp(Buffer.from(await img.arrayBuffer()))
          .rotate()
          .resize(TARGET_W, TARGET_H, { fit: "cover", position: "centre" })
          .webp({ quality: 80 })
          .toBuffer();

        if (promote) {
          fs.writeFileSync(path.join(outDir, `${key}.webp`), out);
          credits[key] = {
            subject: c.title,
            article: c.info.descriptionurl ?? "",
            image: (c.info.url ?? "").split("?")[0],
            note: "Wikimedia Commons — check the file page for the exact licence and author.",
          };
          console.log(`  ${key.padEnd(11)} PROMOTED  ${(out.length / 1024).toFixed(0)}KB  ${c.title.slice(0, 54)}`);
        } else {
          fs.writeFileSync(path.join(candDir, `${key}-${i + 1}.webp`), out);
          console.log(`  ${key.padEnd(11)} [${i + 1}] ${c.title.replace("File:", "").slice(0, 58)}`);
        }
        await sleep(350);
      }
    } catch (e) {
      console.log(`  ${key.padEnd(11)} ERROR ${e.message}`);
    }
  }

  if (promote) fs.writeFileSync(creditsPath, JSON.stringify(credits, null, 2));
}
console.log(promote ? "\npromoted." : "\ncandidates written — review, set CHOSEN, re-run with --promote");
