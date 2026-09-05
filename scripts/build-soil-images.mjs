/**
 * Turns the supplied soil photographs into the web/app assets.
 *
 * The sources are ~3.7MB 1254x1254 PNGs each — 18MB for the five, which is far
 * too heavy to serve and far too heavy to bundle into the Android app. This
 * matches what `fetch-field-images.mjs` already does for the irrigation cards:
 * 640x400 cover crop, webp at quality 80, which lands each card around 40-80KB.
 *
 * Sources stay out of `public/` afterwards so Vercel does not upload them —
 * .vercelignore has no rule for stray PNGs, so anything left in public/ ships.
 *
 * Run: node scripts/build-soil-images.mjs
 */
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const TARGET_W = 640;
const TARGET_H = 400;

const SRC_DIR = path.join(process.cwd(), "public", "images");
const OUT_DIR = path.join(SRC_DIR, "soil");
/** Where the originals are parked — gitignored, and outside public/. */
const ARCHIVE_DIR = path.join(process.cwd(), "design-assets", "soil-src");

/** Source filename → slug. Slugs match SoilKey in components/onboarding/SoilSwatch.tsx. */
const MAP = {
  "Alluvial soil.png": "alluvial",
  "Black soil.png": "black",
  "Red soil.png": "red",
  "Sandy soil.png": "sandy",
  "Clayey soil.png": "clayey",
};

fs.mkdirSync(OUT_DIR, { recursive: true });
fs.mkdirSync(ARCHIVE_DIR, { recursive: true });

let made = 0;
for (const [file, slug] of Object.entries(MAP)) {
  const src = path.join(SRC_DIR, file);
  if (!fs.existsSync(src)) {
    console.warn(`  skip ${file} — not found`);
    continue;
  }

  const out = await sharp(src)
    .resize(TARGET_W, TARGET_H, { fit: "cover", position: "centre" })
    .webp({ quality: 80 })
    .toBuffer();

  const dest = path.join(OUT_DIR, `${slug}.webp`);
  fs.writeFileSync(dest, out);
  const kb = (out.length / 1024).toFixed(0);
  const srcMb = (fs.statSync(src).size / 1024 / 1024).toFixed(1);
  console.log(`  ${slug}.webp  ${kb}KB   (from ${srcMb}MB ${file})`);
  made++;

  // Move, not copy: leaving the original in public/ would deploy it.
  fs.renameSync(src, path.join(ARCHIVE_DIR, file));
}

console.log(`\n${made} soil cards written to public/images/soil/`);
console.log(`originals moved to design-assets/soil-src/ (gitignored, not deployed)`);
