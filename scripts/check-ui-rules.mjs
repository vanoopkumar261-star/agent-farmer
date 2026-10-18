/**
 * Static guards for the Redesign v2 rules that fail silently.
 *
 *     node scripts/check-ui-rules.mjs
 *
 * Exits non-zero on a violation, so it can gate a build.
 *
 * These three were each found in production code by audit, and none of them
 * announces itself — no error, no warning, no visibly broken layout:
 *
 *   dead-opacity   Tailwind 3.4's opacity scale moves in steps of 5, so `/8`
 *                  and `/12` generate NO CSS. Six sites were affected, each
 *                  paired with a `/20` border that did render — so the
 *                  onboarding error banner and the market advice chip read as
 *                  a deliberate thin outline rather than a missing fill.
 *
 *   weight-ceiling The v2 guide caps weight at `font-semibold`. `font-bold`
 *                  and `font-extrabold` look fine in isolation; the damage is
 *                  cumulative, and it is how hierarchy drifts back to being
 *                  carried by weight instead of surface.
 *
 *   chart-hex      Chart colours belong in `src/lib/chartTheme.ts`, whose
 *                  palette was validated for colour-vision deficiency.
 *                  `MarketBoard` kept a local copy and was still on the
 *                  pre-v2 emerald, and a retyped `#7A5C2E` in `SensorPanel`
 *                  had drifted from the validated `#A35A2E`.
 *
 * Marketing pages are excluded: they deliberately run a different theme.
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

/** Scanned: the logged-in app only. */
const ROOTS = [
  "src/app/dashboard",
  "src/app/onboarding",
  "src/components/dashboard",
  "src/components/ui",
  "src/components/onboarding",
];

/** Marketing + deliberate exceptions, matched against the posix-style path. */
const EXCLUDE = [
  /^src\/components\/landing\//,
  /^src\/components\/jaivik\//,
  /\/chartTheme\.ts$/,
  // The shimmer gradient is the component's whole purpose.
  /\/ui\/Skeleton\.tsx$/,
];

const RULES = [
  {
    id: "dead-opacity",
    re: /\b(?:bg|text|border|ring|from|via|to|divide|outline|shadow)-af-[a-z-]+\/(?:8|12)\b/g,
    why: "Tailwind's opacity scale is in steps of 5 — /8 and /12 emit no CSS. Use /10.",
  },
  {
    id: "weight-ceiling",
    re: /\bfont-(?:bold|extrabold|black)\b/g,
    why: "Redesign v2 caps weight at font-semibold.",
  },
  {
    id: "chart-hex",
    // Hex literals in a colour-ish position. Deliberately narrow: `#fff` in an
    // SVG slice separator is not worth failing a build over.
    re: /(?:color|fill|stroke|Color)\s*[:=]\s*["'`]#[0-9a-fA-F]{6}\b/g,
    why: "Chart and mark colours come from src/lib/chartTheme.ts.",
  },
  {
    id: "hardcoded-en-US",
    re: /toLocale\w*\(\s*["']en-US["']/g,
    why: "Use the locale-aware helpers in src/lib/format.ts — en-US renders English dates in all nine languages.",
  },
];

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full, out);
    else if (/\.(tsx?|jsx?)$/.test(e.name)) out.push(full);
  }
  return out;
}

const files = ROOTS.flatMap((r) => walk(path.join(root, r)));
const findings = [];

for (const file of files) {
  const rel = path.relative(root, file).split(path.sep).join("/");
  if (EXCLUDE.some((re) => re.test(rel))) continue;

  const lines = fs.readFileSync(file, "utf8").split("\n");
  lines.forEach((line, i) => {
    // Skip comment-only lines so the rules can be discussed in prose.
    const trimmed = line.trim();
    if (trimmed.startsWith("//") || trimmed.startsWith("*") || trimmed.startsWith("/*")) return;

    for (const rule of RULES) {
      rule.re.lastIndex = 0;
      const hits = line.match(rule.re);
      if (hits) findings.push({ rel, line: i + 1, rule, hit: hits[0] });
    }
  });
}

if (!findings.length) {
  console.log(`ui-rules: clean (${files.length} files)`);
  process.exit(0);
}

const byRule = new Map();
for (const f of findings) {
  if (!byRule.has(f.rule.id)) byRule.set(f.rule.id, []);
  byRule.get(f.rule.id).push(f);
}

console.error(`ui-rules: ${findings.length} violation(s) in ${files.length} files\n`);
for (const [id, list] of byRule) {
  console.error(`  ${id} — ${list[0].rule.why}`);
  for (const f of list.slice(0, 25)) console.error(`    ${f.rel}:${f.line}  ${f.hit}`);
  if (list.length > 25) console.error(`    … and ${list.length - 25} more`);
  console.error("");
}
process.exit(1);
