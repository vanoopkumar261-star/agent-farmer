/**
 * Multilingual transcription accuracy benchmark.
 *
 *   node scripts/dryrun/accuracy.mjs                    all 8 non-English locales, all variants
 *   node scripts/dryrun/accuracy.mjs --locale kn,ta      just these locales
 *   node scripts/dryrun/accuracy.mjs --variant vocab     just this prompt variant (+ "none" control)
 *   node scripts/dryrun/accuracy.mjs --class money       just this utterance class
 *
 * What this measures and why it's shaped this way:
 *
 * Groq hosts Whisper; there is no fine-tuning surface on it, and we have no
 * recorded farmer audio to fine-tune an open model with anyway. So "training
 * for accuracy" here means the two levers Groq's API actually exposes per
 * request — the `prompt` string and the `language` hint — measured against a
 * corpus built around the four classes that matter to an agent that acts:
 * money/quantities, crop & input entities, short commands, and longer
 * scheme/date/symptom utterances.
 *
 * Audio is synthesized ONCE per phrase (ml/server.py MMS-TTS) and reused across
 * every prompt variant, so a difference in score is attributable to the prompt,
 * not to a different TTS render. This is a direct extension of the fix already
 * shipped: that fix proved an English prompt breaks 6 of 9 languages; this
 * measures whether a TRANSLATED prompt, and a translated prompt plus in-script
 * vocabulary, do better than sending no prompt at all.
 *
 * This bypasses our own /api/transcribe entirely and calls Groq's Whisper
 * endpoint directly, because the point is to compare prompt strategies the
 * route does not yet implement — it is a benchmarking tool that produces a
 * recommendation for the route, not a test of the route as shipped.
 *
 * ⚠ Ceiling, not forecast — same caveat as every synthetic-audio result in this
 * harness: MMS-TTS is clean, evenly paced, and nothing like a farmer in a
 * field. Read this as "which lever helps," not "this is real-world WER."
 */
import { loadEnv } from "./lib/env.mjs";
import { fetchRetry, sleep } from "./lib/fetchx.mjs";
import { scoreUtterance, scriptShare, SCRIPT_RANGE } from "./lib/score.mjs";
import { buildPrompt, VARIANTS } from "./lib/prompts.mjs";
import { CORPUS, CLASSES } from "./fixtures/phrases.mjs";
import fs from "node:fs";
import path from "node:path";
import { OUT_DIR } from "./lib/report.mjs";

loadEnv();

const argv = process.argv.slice(2);
const valueOf = (f) => {
  const i = argv.indexOf(f);
  return i >= 0 ? argv[i + 1] : null;
};
const listArg = (f, dflt) => {
  const v = valueOf(f);
  return v ? v.split(",").map((s) => s.trim()) : dflt;
};

// Synthesis comes from the speech server (ml/tts), not the disease one.
const ML = process.env.TTS_URL?.replace(/\/+$/, "") || "http://127.0.0.1:8009";
const ISO639 = { en: "en", hi: "hi", kn: "kn", ta: "ta", te: "te", ml: "ml", mr: "mr", bn: "bn", pa: "pa" };

const locales = listArg("--locale", Object.keys(CORPUS).filter((l) => l !== "en"));
const variants = listArg("--variant", VARIANTS);
const wantClass = valueOf("--class");
const limit = Number(valueOf("--limit") || "0") || null;

async function tts(text, locale) {
  const { res, ms, error } = await fetchRetry(
    `${ML}/tts`,
    { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text, locale }) },
    { retries: 0, timeoutMs: 300_000 }
  );
  if (!res) throw new Error(`ml/tts unreachable: ${error?.message ?? error}`);
  if (!res.ok) throw new Error(`ml/tts ${res.status}: ${(await res.text().catch(() => "")).slice(0, 200)}`);
  return { buf: Buffer.from(await res.arrayBuffer()), ms };
}

/**
 * A rolling-window request limiter for Groq's Whisper endpoint.
 *
 * Discovered the hard way: whisper-large-v3-turbo on the free tier caps at
 * 20 requests/minute — far tighter than the chat endpoint's budget the rest of
 * this harness was tuned against, and two-thirds of the first full run 429'd
 * before this existed. Capped at 16 to leave headroom for the mandatory retry
 * after a transient 429.
 */
const WHISPER_RPM_CEILING = 16;
const whisperCalls = [];

async function throttleWhisper() {
  for (;;) {
    const cutoff = Date.now() - 60_000;
    while (whisperCalls.length && whisperCalls[0] < cutoff) whisperCalls.shift();
    if (whisperCalls.length < WHISPER_RPM_CEILING) {
      whisperCalls.push(Date.now());
      return;
    }
    const waitMs = whisperCalls[0] + 60_000 - Date.now() + 200;
    await sleep(Math.max(500, waitMs));
  }
}

/** Groq's 429 body names the wait in prose: "Please try again in 3s." */
function parseRetrySeconds(message) {
  const m = /try again in ([\d.]+)s/i.exec(message ?? "");
  return m ? Math.ceil(parseFloat(m[1])) : 5;
}

async function whisper(wavBuf, locale, prompt) {
  const key = process.env.GROQ_API_KEY;
  if (!key) throw new Error("GROQ_API_KEY not set");

  for (let attempt = 0; attempt < 4; attempt++) {
    await throttleWhisper();
    const form = new FormData();
    form.append("file", new Blob([wavBuf], { type: "audio/wav" }), "speech.wav");
    form.append("model", "whisper-large-v3-turbo");
    form.append("language", ISO639[locale] ?? "en");
    form.append("response_format", "json");
    if (prompt) form.append("prompt", prompt);

    const { res, ms } = await fetchRetry(
      "https://api.groq.com/openai/v1/audio/transcriptions",
      { method: "POST", headers: { Authorization: `Bearer ${key}` }, body: form },
      { retries: 0, timeoutMs: 60_000 }
    );
    if (!res) throw new Error("groq whisper unreachable");
    const json = await res.json().catch(() => ({}));

    if (res.status === 429) {
      const waitS = parseRetrySeconds(json?.error?.message);
      process.stdout.write(`    (429, waiting ${waitS}s)\n`);
      await sleep((waitS + 1) * 1000);
      continue; // does not consume a retry-count slot in the rolling window
    }
    if (!res.ok) throw new Error(`groq whisper ${res.status}: ${json?.error?.message ?? "unknown"}`);
    return { text: json?.text ?? "", ms, attempts: attempt + 1 };
  }
  throw new Error("groq whisper: gave up after repeated 429s");
}

function mean(nums) {
  return nums.length ? Number((nums.reduce((a, b) => a + b, 0) / nums.length).toFixed(3)) : 0;
}

async function main() {
  console.log(`Multilingual accuracy benchmark`);
  console.log(`locales: ${locales.join(", ")}`);
  console.log(`variants: ${variants.join(", ")}`);
  console.log(`class filter: ${wantClass ?? "all"}\n`);

  // Health check up front — this whole run is wasted without it.
  const health = await fetchRetry(`${ML}/health`, {}, { retries: 0, timeoutMs: 5000 }).then((r) => r.res?.ok);
  if (!health) {
    console.error(`ml/tts/server.py is not reachable at ${ML}. Start it:`);
    console.error(`  cd ml/tts && .venv/Scripts/python.exe -m uvicorn server:app --host 127.0.0.1 --port 8009`);
    process.exit(1);
  }

  const rows = []; // { locale, id, cls, variant, ratio, scriptShare, ms } — real observations only
  const errors = []; // harness/network failures, kept separate from the data
  let ttsCount = 0;
  let whisperCount = 0;

  for (const locale of locales) {
    const range = SCRIPT_RANGE[locale];
    let phrases = CORPUS[locale] ?? [];
    if (wantClass) phrases = phrases.filter((p) => p.cls === wantClass);
    if (limit) phrases = phrases.slice(0, limit);

    for (const phrase of phrases) {
      let wav;
      try {
        const r = await tts(phrase.text, locale);
        wav = r.buf;
        ttsCount++;
      } catch (e) {
        console.error(`  [${locale}/${phrase.id}] TTS failed: ${e.message}`);
        continue;
      }

      for (const variant of variants) {
        const prompt = buildPrompt(locale, variant);
        try {
          const { text: heard } = await whisper(wav, locale, prompt);
          whisperCount++;
          const s = scoreUtterance(heard, phrase.keys);
          const share = scriptShare(heard, range);
          rows.push({ locale, id: phrase.id, cls: phrase.cls, variant, ratio: s.ratio, missed: s.missed, scriptShare: share, heard });
          process.stdout.write(
            `  ${locale}/${phrase.id.padEnd(3)} [${variant.padEnd(10)}] ratio=${s.ratio} script=${share} ${
              s.missed.length ? `missed:${s.missed.join(",")}` : ""
            }\n`
          );
        } catch (e) {
          // A harness/network error is NOT a language-accuracy data point —
          // scoring it as ratio 0 would silently corrupt every average it
          // touches. Kept out of `rows` entirely; logged so it's still visible.
          console.error(`  ${locale}/${phrase.id} [${variant}] SKIPPED (harness error): ${e.message}`);
          errors.push({ locale, id: phrase.id, variant, error: e.message });
        }
      }
    }
  }

  const expectedPerCell = () => {
    let n = CORPUS[locales[0]]?.length ?? 12;
    if (wantClass) n = (CORPUS[locales[0]] ?? []).filter((p) => p.cls === wantClass).length;
    if (limit) n = Math.min(n, limit);
    return n;
  };
  const expected = expectedPerCell();
  const cellsIncomplete = errors.length > 0;

  // ── aggregate: locale × variant ──────────────────────────────────────────
  console.log(`\n${"─".repeat(78)}`);
  console.log(`Mean entity-recall by locale × prompt variant  (n/${expected} per cell)\n`);
  console.log(`locale   ${variants.map((v) => v.padEnd(13)).join("")}`);
  const bestByLocale = {};
  for (const locale of locales) {
    const cells = variants.map((v) => {
      const rs = rows.filter((r) => r.locale === locale && r.variant === v).map((r) => r.ratio);
      return { v, m: mean(rs), n: rs.length };
    });
    const complete = cells.filter((c) => c.n === expected);
    const best = (complete.length ? complete : cells).reduce((a, b) => (b.m > a.m ? b : a), (complete.length ? complete : cells)[0]);
    bestByLocale[locale] = best;
    console.log(
      `${locale.padEnd(9)}${cells
        .map((c) => `${c.v === best.v ? "*" : " "}${c.m} (${c.n}/${expected})`.padEnd(13))
        .join("")}`
    );
  }
  console.log(`\n* = best-scoring variant with a full sample for that locale`);

  // ── aggregate: class × variant, across all locales ───────────────────────
  console.log(`\nMean entity-recall by utterance class × prompt variant, all locales (n shown)\n`);
  console.log(`class       ${variants.map((v) => v.padEnd(13)).join("")}`);
  for (const cls of CLASSES) {
    const cells = variants.map((v) => {
      const rs = rows.filter((r) => r.cls === cls && r.variant === v).map((r) => r.ratio);
      return `${mean(rs)} (n=${rs.length})`.padEnd(13);
    });
    console.log(`${cls.padEnd(12)}${cells.join("")}`);
  }

  // ── recommendation, only where the sample is real ────────────────────────
  console.log(`\n${"─".repeat(78)}`);
  console.log(`Recommendation per locale:\n`);
  for (const [locale, best] of Object.entries(bestByLocale)) {
    const noneRow = rows.filter((r) => r.locale === locale && r.variant === "none");
    const noneScore = mean(noneRow.map((r) => r.ratio));
    const gain = best.m - noneScore;
    const flag = best.n < expected ? "  ⚠ incomplete sample — do not act on this yet" : "";
    console.log(
      `  ${locale}: use "${best.v}" prompt (${best.m} vs ${noneScore} with none, ${gain >= 0 ? "+" : ""}${gain.toFixed(3)}, n=${best.n}/${expected})${flag}`
    );
  }

  if (cellsIncomplete) {
    console.log(`\n⚠ ${errors.length} call(s) were skipped after repeated 429s and excluded from every average above.`);
    console.log(`  Re-run the affected cells before trusting a close result. See the errors[] array in the JSON.`);
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const file = path.join(OUT_DIR, `accuracy-${Date.now()}.json`);
  fs.writeFileSync(
    file,
    JSON.stringify(
      { at: new Date().toISOString(), locales, variants, expectedPerCell: expected, ttsCount, whisperCount, rows, errors, bestByLocale },
      null,
      2
    ),
    "utf8"
  );
  console.log(`\nfull data: ${path.relative(process.cwd(), file)}`);
  console.log(`${ttsCount} synthesis calls, ${whisperCount} successful Whisper calls, ${errors.length} skipped after retries`);
}

main().catch((e) => {
  console.error("benchmark failed:", e);
  process.exit(2);
});
