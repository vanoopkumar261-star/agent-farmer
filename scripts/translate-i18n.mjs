/**
 * Fills a locale's dictionary from the English one, via NVIDIA Riva Translate.
 *
 *     node scripts/translate-i18n.mjs --prefix irrigation.
 *     node scripts/translate-i18n.mjs --prefix irrigation. --locale hi --dry
 *
 * Reads the `en` block of a dictionary in `src/lib/i18n/`, takes every key
 * matching `--prefix`, translates it, and writes the results into the target
 * locale's block — replacing that locale's existing entry for a key if it has
 * one, inserting it if not. Keys outside the prefix are never touched, and no
 * other locale's block is read or written.
 *
 * ── Why this is a script and not a runtime call ───────────────────────────────
 *
 * Static UI copy is known before the farmer arrives, so translating it at
 * request time would buy nothing and cost a round trip on every page view. It
 * is translated once, here, and the output is committed — which also means a
 * human can read the Hindi in a diff and fix anything the model got wrong.
 * `src/lib/translate.ts` is the runtime sibling, and it exists for the one
 * thing this cannot cover: prose the engine composes from a farm's own numbers.
 *
 * ── The trap this script exists to close ─────────────────────────────────────
 *
 * The model translates placeholder *names*. Asked for Hindi, `{crop}` comes
 * back as `{कटाई}` and `{farm}` as `{फार्म}` — which does not throw, does not
 * look wrong in a diff if you do not read Devanagari, and silently breaks
 * interpolation: `translate()` substitutes `{crop}`, finds nothing, and renders
 * the literal braces to the farmer.
 *
 * So placeholders are swapped for opaque sentinels before the call and restored
 * after, and then every placeholder is *verified* present. A string that comes
 * back with one missing keeps its English and is reported — a loud gap beats a
 * quiet corruption, because the English at least reads.
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

// ── args ─────────────────────────────────────────────────────────────────────

const argv = process.argv.slice(2);
const arg = (name, fallback) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[i + 1] : fallback;
};
const has = (name) => argv.includes(`--${name}`);

const LOCALE = arg("locale", "hi");
const PREFIX = arg("prefix", "");
const DICT = arg("dict", "dashboard");
const DRY = has("dry");

if (!PREFIX) {
  console.error("Missing --prefix (e.g. --prefix irrigation.)");
  process.exit(1);
}

/**
 * Locale → the model's language-pair tag.
 *
 * Kept in step with PAIR_TAG in src/lib/translate.ts. This is not a general
 * language code: the pair goes in the system message as `en-hi`, and a guess
 * fails in a way that looks like success — asking for Hindi in prose returned
 * Danish, and so did `en-hi-in`.
 */
const PAIR_TAG = {
  hi: "en-hi",
  kn: "en-kn",
  ta: "en-ta",
  te: "en-te",
  ml: "en-ml",
  mr: "en-mr",
  bn: "en-bn",
  pa: "en-pa",
};

if (!PAIR_TAG[LOCALE]) {
  console.error(`No language-pair tag for "${LOCALE}". Known: ${Object.keys(PAIR_TAG).join(", ")}`);
  process.exit(1);
}

// ── env ──────────────────────────────────────────────────────────────────────

function readEnv(file) {
  const p = path.join(root, file);
  if (!fs.existsSync(p)) return {};
  return Object.fromEntries(
    fs
      .readFileSync(p, "utf8")
      .split("\n")
      .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
      .map((l) => {
        const i = l.indexOf("=");
        return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
      })
  );
}

const env = { ...readEnv(".env.local"), ...process.env };
const KEY = env.NVIDIA_API_KEY;
const MODEL = env.NVIDIA_TRANSLATE_MODEL || "nvidia/riva-translate-4b-instruct-v2";

if (!KEY) {
  console.error("Missing NVIDIA_API_KEY in .env.local");
  process.exit(1);
}

// ── dictionary parsing ───────────────────────────────────────────────────────

const dictPath = path.join(root, "src", "lib", "i18n", `${DICT}.ts`);
if (!fs.existsSync(dictPath)) {
  console.error(`No such dictionary: ${dictPath}`);
  process.exit(1);
}
let source = fs.readFileSync(dictPath, "utf8");

/**
 * The character span of one locale's object literal.
 *
 * Deliberately brace-counted from `const <locale>: Dict = {` rather than
 * regex-matched to the closing `};`: these files are 5k+ lines of one flat
 * object per locale, and a non-greedy regex would stop at the first `};` while
 * a greedy one would swallow every locale after it.
 */
function blockRange(text, locale) {
  const start = text.indexOf(`const ${locale}: Dict = {`);
  if (start < 0) return null;
  const open = text.indexOf("{", start);
  let depth = 0;
  for (let i = open; i < text.length; i++) {
    if (text[i] === "{") depth++;
    else if (text[i] === "}") {
      depth--;
      if (depth === 0) return { open, close: i };
    }
  }
  return null;
}

/** Every "key": "value" pair in a block, values unescaped. */
function parsePairs(block) {
  const out = new Map();
  const re = /^[ \t]*"((?:[^"\\]|\\.)*)"[ \t]*:[ \t]*"((?:[^"\\]|\\.)*)"[ \t]*,?[ \t]*$/gm;
  let m;
  while ((m = re.exec(block))) {
    const k = m[1].replace(/\\(.)/g, "$1");
    const v = m[2].replace(/\\"/g, '"').replace(/\\\\/g, "\\");
    out.set(k, v);
  }
  return out;
}

const enRange = blockRange(source, "en");
const locRange = blockRange(source, LOCALE);
if (!enRange || !locRange) {
  console.error(`Could not locate the en and ${LOCALE} blocks in ${DICT}.ts`);
  process.exit(1);
}

const enPairs = parsePairs(source.slice(enRange.open, enRange.close));
const targets = [...enPairs.entries()].filter(([k]) => k.startsWith(PREFIX));

if (!targets.length) {
  console.error(`No en keys start with "${PREFIX}"`);
  process.exit(1);
}

console.log(`${targets.length} key(s) under "${PREFIX}" → ${LOCALE} (${PAIR_TAG[LOCALE]})`);

// ── placeholder protection ───────────────────────────────────────────────────

const PLACEHOLDER = /\{(\w+)\}/g;

/** `"over {acres} acres"` → `{ masked: "over ⟦0⟧ acres", names: ["acres"] }` */
function mask(text) {
  const names = [];
  const masked = text.replace(PLACEHOLDER, (_, name) => {
    names.push(name);
    return `\u27e6${names.length - 1}\u27e7`;
  });
  return { masked, names };
}

function unmask(text, names) {
  let out = text;
  names.forEach((name, i) => {
    out = out.split(`\u27e6${i}\u27e7`).join(`{${name}}`);
  });
  return out;
}

// ── translation ──────────────────────────────────────────────────────────────

async function translateOne(text) {
  const { masked, names } = mask(text);

  const res = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: "system", content: PAIR_TAG[LOCALE] },
        { role: "user", content: masked },
      ],
      temperature: 0,
      max_tokens: Math.max(256, masked.length * 3),
    }),
  });

  if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);

  const data = await res.json();
  const raw = data?.choices?.[0]?.message?.content?.trim();
  if (!raw) throw new Error("empty reply");

  const restored = unmask(raw, names);

  // The verification this script exists for. Every placeholder the English had
  // must survive into the translation, or interpolation breaks at runtime.
  const missing = names.filter((n) => !restored.includes(`{${n}}`));
  if (missing.length) throw new Error(`lost placeholder(s): ${missing.map((n) => `{${n}}`).join(", ")}`);

  // A sentinel left in the output means the model split or duplicated one, and
  // the result would show `⟦0⟧` to a farmer.
  if (/\u27e6\d+\u27e7/.test(restored)) throw new Error("sentinel survived unmasking");

  return restored;
}

const translated = new Map();
const failed = [];

for (const [key, en] of targets) {
  try {
    const out = await translateOne(en);
    translated.set(key, out);
    console.log(`  ok   ${key}`);
  } catch (e) {
    failed.push([key, e.message]);
    console.log(`  SKIP ${key} — ${e.message}`);
  }
  // Gentle on a free endpoint; this runs once per locale, not per request.
  await new Promise((r) => setTimeout(r, 120));
}

if (!translated.size) {
  console.error("\nNothing translated; leaving the dictionary untouched.");
  process.exit(1);
}

// ── write back ───────────────────────────────────────────────────────────────

const esc = (v) => v.replace(/\\/g, "\\\\").replace(/"/g, '\\"');

if (DRY) {
  console.log(`\n--dry, so nothing written. ${translated.size} line(s) would be:\n`);
  for (const [k, v] of translated) console.log(`  "${k}": "${esc(v)}",`);
  process.exit(0);
}

// Re-read the target block fresh, and rewrite it as a whole: replace the lines
// for keys this locale already had, then append the rest just before its
// closing brace. Only this locale's block is rewritten.
let block = source.slice(locRange.open + 1, locRange.close);
const existing = parsePairs(block);

let replaced = 0;
let appended = 0;
const toAppend = [];

for (const [k, v] of translated) {
  const line = `  "${esc(k)}": "${esc(v)}",`;
  if (existing.has(k)) {
    const re = new RegExp(
      `^[ \\t]*"${k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"[ \\t]*:[ \\t]*"(?:[^"\\\\]|\\\\.)*"[ \\t]*,?[ \\t]*$`,
      "m"
    );
    if (re.test(block)) {
      block = block.replace(re, line);
      replaced++;
      continue;
    }
  }
  toAppend.push(line);
  appended++;
}

if (toAppend.length) {
  block = `${block.replace(/\s*$/, "")}\n${toAppend.join("\n")}\n`;
}

source = source.slice(0, locRange.open + 1) + block + source.slice(locRange.close);
fs.writeFileSync(dictPath, source, "utf8");

console.log(
  `\n${DICT}.ts [${LOCALE}]: ${replaced} replaced, ${appended} added, ${failed.length} left in English.`
);
if (failed.length) {
  console.log("Left in English (they will fall back, so nothing renders broken):");
  for (const [k, why] of failed) console.log(`  ${k} — ${why}`);
}
