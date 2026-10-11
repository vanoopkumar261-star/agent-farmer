/**
 * Layer S — the voice pipe, without a microphone.
 *
 * Synthesize a known sentence with the local speech server, post the WAV to
 * /api/transcribe, and diff the result against the text we started from. The
 * two halves fit together for free: ml/tts/server.py writes a real RIFF/WAVE
 * container via the stdlib `wave` module, and the transcribe route's magic-byte
 * sniffer accepts `RIFF....WAVE` explicitly, so nothing has to be transcoded.
 *
 * ⚠ These numbers are a CEILING, not a forecast. Synthetic speech is clean,
 * evenly paced, and free of wind, tractors and a farmer standing two feet from
 * the phone. A real recording will score worse, and the sentences here are
 * deliberately loaded with the two things most likely to be misheard in the
 * field — a rupee amount and a fertiliser name — because that is where a wrong
 * transcription becomes a wrong ledger entry.
 */
import { STATUS, runProbe } from "../lib/probe.mjs";
import { fetchRetry, readBody, clip, sleep } from "../lib/fetchx.mjs";
import { createUser, signIn, deleteUser, seedFarmer, teardown, testEmail } from "../lib/account.mjs";

// The speech server, not the disease one — see ttsBaseUrl in src/lib/inference.ts.
const TTS = process.env.TTS_URL?.replace(/\/+$/, "") || "http://127.0.0.1:8009";

/**
 * A rupee amount and an input name in every one, in all nine locales.
 *
 * The script range matters as much as the words: on 2026-09-07 six of these
 * came back as fluent ENGLISH prose because /api/transcribe attached an English
 * domain prompt to a non-English `language` hint. Fluent English is much harder
 * to notice than garbled Kannada, so the assertion checks the script, not just
 * the amount.
 */
const PHRASES = [
  ["en", "I bought urea for two thousand rupees today", null],
  ["hi", "मैंने आज दो हज़ार रुपये का यूरिया खरीदा", [0x900, 0x97f]],
  ["kn", "ನಾನು ಇಂದು ಎರಡು ಸಾವಿರ ರೂಪಾಯಿ ಯೂರಿಯಾ ಖರೀದಿಸಿದೆ", [0xc80, 0xcff]],
  ["ta", "நான் இன்று இரண்டாயிரம் ரூபாய்க்கு யூரியா வாங்கினேன்", [0xb80, 0xbff]],
  ["te", "నేను ఈరోజు రెండు వేల రూపాయల యూరియా కొన్నాను", [0xc00, 0xc7f]],
  ["ml", "ഞാൻ ഇന്ന് രണ്ടായിരം രൂപയുടെ യൂറിയ വാങ്ങി", [0xd00, 0xd7f]],
  ["mr", "मी आज दोन हजार रुपयांचे युरिया विकत घेतले", [0x900, 0x97f]],
  ["bn", "আমি আজ দুই হাজার টাকার ইউরিয়া কিনেছি", [0x980, 0x9ff]],
  ["pa", "ਮੈਂ ਅੱਜ ਦੋ ਹਜ਼ਾਰ ਰੁਪਏ ਦਾ ਯੂਰੀਆ ਖਰੀਦਿਆ", [0xa00, 0xa7f]],
];

/** Share of letters that fall inside the locale's Unicode block. */
function scriptShare(text, range) {
  if (!range) return 1;
  const letters = [...(text ?? "")].filter((c) => /\p{L}/u.test(c));
  if (!letters.length) return 0;
  const inRange = letters.filter((c) => {
    const p = c.codePointAt(0);
    return p >= range[0] && p <= range[1];
  });
  return Number((inRange.length / letters.length).toFixed(2));
}

const norm = (s) =>
  (s ?? "")
    .toLowerCase()
    .replace(/[.,!?;:।॥"'`()\-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/**
 * Token recall, with a caveat that turned out to matter more than the metric.
 *
 * Whisper normalises spoken number words into digits: "two thousand rupees"
 * comes back as "2,000 rupees". A naive word diff scores that as two words lost
 * and reports a transcription failure that did not happen. So the amount is
 * checked separately, as a VALUE, and the token ratio is reported as context
 * only — it is pessimistic by construction wherever a number was spoken.
 */
function overlap(expected, got) {
  const e = norm(expected).split(" ").filter(Boolean);
  const g = new Set(norm(got).split(" ").filter(Boolean));
  if (!e.length) return { matched: 0, total: 0, ratio: 0, missing: [] };
  const missing = e.filter((w) => !g.has(w));
  const matched = e.length - missing.length;
  return { matched, total: e.length, ratio: Number((matched / e.length).toFixed(2)), missing };
}

/**
 * Did the rupee amount survive, in any spelling?
 *
 * This is the assertion that actually matters: a lost or altered amount is a
 * wrong ledger entry, and it is the one error a farmer who cannot read the
 * screen will never catch.
 *
 * Three ways it can legitimately come back, and all three count:
 *   · as digits — Whisper normalises "two thousand" to "2,000"
 *   · as number words in the native script
 *   · as number words with a one- or two-character slip, which is what a
 *     transcriber does with synthetic speech and is not a lost amount
 *
 * The tolerance is computed from the phrase, not hardcoded per language, so
 * this does not quietly overfit to the exact garbling seen on one run.
 */
const TWO_THOUSAND = {
  en: "two thousand",
  hi: "दो हज़ार",
  kn: "ಎರಡು ಸಾವಿರ",
  ta: "இரண்டாயிரம்",
  te: "రెండు వేల",
  ml: "രണ്ടായിരം",
  mr: "दोन हजार",
  bn: "দুই হাজার",
  pa: "ਦੋ ਹਜ਼ਾਰ",
};

/** Drop combining marks so a missing nukta or vowel sign is not a lost amount. */
const bare = (s) =>
  (s ?? "").normalize("NFD").replace(/\p{M}/gu, "").replace(/[\s ]/g, "").toLowerCase();

function editDistance(a, b) {
  const m = a.length;
  const n = b.length;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[n];
}

function amountSurvived(heard, locale) {
  const digits = (heard ?? "").replace(/[,\s .]/g, "");
  if (/2000/.test(digits)) return { ok: true, how: "digits", distance: 0 };

  const target = bare(TWO_THOUSAND[locale] ?? "");
  if (!target) return { ok: false, how: null, distance: null };
  const hay = bare(heard);
  if (hay.includes(target)) return { ok: true, how: "words", distance: 0 };

  // Slide a window the length of the target and take the closest match.
  const tol = Math.max(2, Math.round(target.length * 0.2));
  let best = Infinity;
  for (let i = 0; i + target.length <= hay.length; i++) {
    for (const w of [target.length - 1, target.length, target.length + 1]) {
      if (w <= 0 || i + w > hay.length) continue;
      best = Math.min(best, editDistance(hay.slice(i, i + w), target));
    }
    if (best === 0) break;
  }
  return { ok: best <= tol, how: best <= tol ? `words (${best} char slip)` : null, distance: best === Infinity ? null : best };
}

async function tts(text, locale) {
  const { res, ms, error } = await fetchRetry(
    `${TTS}/tts`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, locale }),
    },
    { retries: 0, timeoutMs: 420_000 }
  );
  if (!res) return { error };
  if (!res.ok) return { status: res.status, text: await res.text().catch(() => "") };
  const buf = Buffer.from(await res.arrayBuffer());
  return { status: res.status, buf, ms };
}

export async function speechProbes(app, opts = {}) {
  const out = [];
  const locales = opts.full ? PHRASES : PHRASES.slice(0, 3);

  // ── is the server there, and which languages does it claim? ─────────────
  let health = null;
  out.push(
    await runProbe(
      { id: "speech.health", layer: "speech", title: "Speech server is up", expected: [STATUS.LIVE, STATUS.ABSENT] },
      async () => {
        const { res, ms, error } = await fetchRetry(`${TTS}/health`, {}, { retries: 0, timeoutMs: 5000 });
        if (!res) {
          return {
            status: STATUS.ABSENT,
            ms,
            evidence: { url: TTS, error: String(error?.message ?? error) },
            verdict: `not running at ${TTS} — the speech suite cannot run. Start it: cd ml/tts && .venv/Scripts/python.exe -m uvicorn server:app --port 8009`,
          };
        }
        const { json } = await readBody(res);
        health = json;
        const voices = [...(json?.chatterbox_locales ?? []), ...(json?.mms_locales ?? [])];
        return {
          status: STATUS.LIVE,
          ms,
          evidence: json,
          verdict: `up; device=${json?.device}; chatterbox_ready=${json?.chatterbox_ready}; voices: ${voices.join(" ")}`,
        };
      }
    )
  );

  if (!health) return out;

  // ── /api/tts must refuse an anonymous caller even when the server is up ──
  if (app) {
    out.push(
      await runProbe(
        { id: "speech.tts.anon_refused", layer: "speech", title: "/api/tts still requires a session", expected: [STATUS.LIVE] },
        async () => {
          const { res, ms } = await fetchRetry(
            `${app}/api/tts`,
            { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: "hello", locale: "en" }) },
            { retries: 0 }
          );
          if (!res) return { status: STATUS.FAIL, ms, verdict: "unreachable" };
          return {
            status: res.status === 401 ? STATUS.LIVE : STATUS.FAIL,
            ms,
            evidence: { status: res.status },
            verdict: res.status === 401 ? "401 as required" : `expected 401, got ${res.status}`,
          };
        }
      )
    );
  }

  // ── an authenticated session, purely so /api/transcribe will answer ──────
  let session = null;
  let user = null;
  let seeded = null;
  try {
    if (app) {
      try {
        user = await createUser(testEmail(`spch${Date.now().toString(36)}`));
        session = await signIn(user.email, user.password);
        // Both /api/transcribe and /api/tts resolve getSessionFarmer(), so an
        // auth user with no farmer_profile is refused with "Not signed in." —
        // a session alone is not enough.
        seeded = await seedFarmer(session.client, user.id, "speech");
      } catch (e) {
        out.push(
          await runProbe(
            { id: "speech.session", layer: "speech", title: "Session for /api/transcribe", expected: [STATUS.LIVE] },
            async () => ({ status: STATUS.SKIP, ms: 0, verdict: `could not create a throwaway account: ${e?.message ?? e}` })
          )
        );
      }
    }

    for (const [locale, phrase, range] of locales) {
      // ── synthesis ───────────────────────────────────────────────────────
      let wav = null;
      out.push(
        await runProbe(
          {
            id: `speech.tts.${locale}`,
            layer: "speech",
            title: `Speech server synthesises ${locale}`,
            expected: [STATUS.LIVE],
          },
          async () => {
            const r = await tts(phrase, locale);
            if (r.error) return { status: STATUS.FAIL, ms: 0, verdict: `unreachable: ${r.error?.message ?? r.error}` };
            if (!r.buf) {
              return { status: STATUS.FAIL, ms: r.ms, evidence: { status: r.status, body: clip(r.text, 200) }, verdict: `${r.status}: ${clip(r.text, 120)}` };
            }
            wav = r.buf;
            const riff = r.buf.subarray(0, 4).toString("ascii") === "RIFF" && r.buf.subarray(8, 12).toString("ascii") === "WAVE";
            return {
              status: riff ? STATUS.LIVE : STATUS.FAIL,
              ms: r.ms,
              evidence: { bytes: r.buf.length, riffWave: riff, firstUse: true },
              verdict: `${r.buf.length} bytes of ${riff ? "valid RIFF/WAVE" : "SOMETHING THAT IS NOT WAV"} in ${r.ms}ms (first use pays the model load)`,
            };
          }
        )
      );

      // ── the LRU cache, proved without paying a second cold load ─────────
      out.push(
        await runProbe(
          { id: `speech.tts.cache.${locale}`, layer: "speech", title: `Repeat synthesis hits the cache (${locale})`, expected: [STATUS.CACHED] },
          async () => {
            if (!wav) return { status: STATUS.SKIP, ms: 0, verdict: "no first synthesis to compare against" };
            const r = await tts(phrase, locale);
            if (!r.buf) return { status: STATUS.FAIL, ms: 0, verdict: `repeat failed: ${r.status}` };
            const identical = Buffer.compare(wav, r.buf) === 0;
            const fast = r.ms < 400;
            return {
              status: identical ? STATUS.CACHED : STATUS.DEGRADED,
              ms: r.ms,
              evidence: { identical, ms: r.ms, bytes: r.buf.length },
              verdict: `${r.ms}ms, byte-identical=${identical}${fast ? " — served from the 32-entry LRU" : " — slower than a cache hit should be"}`,
            };
          }
        )
      );

      // ── the round trip ──────────────────────────────────────────────────
      out.push(
        await runProbe(
          {
            id: `speech.roundtrip.${locale}`,
            layer: "speech",
            title: `TTS → Whisper round trip (${locale})`,
            expected: [STATUS.LIVE],
          },
          async () => {
            if (!wav) return { status: STATUS.SKIP, ms: 0, verdict: "no audio to transcribe" };
            if (!session?.token) return { status: STATUS.SKIP, ms: 0, verdict: "/api/transcribe needs a session and none was created" };

            const form = new FormData();
            form.append("audio", new Blob([wav], { type: "audio/wav" }), "speech.wav");
            form.append("locale", locale);
            const { res, ms, error } = await fetchRetry(
              `${app}/api/transcribe`,
              { method: "POST", body: form, headers: { Authorization: `Bearer ${session.token}` } },
              { retries: 0, timeoutMs: 90_000 }
            );
            if (!res) return { status: STATUS.FAIL, ms, verdict: `unreachable: ${error?.message ?? error}` };
            const { json, text } = await readBody(res);
            if (!res.ok) {
              return { status: STATUS.FAIL, ms, evidence: { status: res.status, body: clip(text, 200) }, verdict: `${res.status}: ${clip(text, 140)}` };
            }
            const heard = json?.text ?? "";
            const o = overlap(phrase, heard);
            const amount = amountSurvived(heard, locale);
            // The amount is the pass/fail criterion, not the word ratio. A
            // transcription that renders "two thousand" as "2,000" is correct
            // — arguably better, since the agent wants a number anyway.
            const share = scriptShare(heard, range);
            // Wrong-script output is the more dangerous failure: fluent English
            // returned for a Kannada question looks like a transcription.
            const rightScript = share >= 0.5;
            const ok = amount.ok && rightScript;
            return {
              status: ok ? STATUS.LIVE : STATUS.DEGRADED,
              ms,
              evidence: { said: phrase, heard, ...o, amountSurvived: amount.ok, amountAs: amount.how, scriptShare: share },
              verdict: !rightScript
                ? `WRONG SCRIPT — ${Math.round(share * 100)}% of letters in the expected block. Heard "${clip(heard, 70)}"`
                : amount.ok
                  ? `amount survived as ${amount.how}; script ${Math.round(share * 100)}% — "${clip(heard, 80)}"`
                  : `AMOUNT LOST — said "${clip(phrase, 45)}", heard "${clip(heard, 60)}"`,
            };
          }
        )
      );

      await sleep(800);
    }

    // ── /api/tts end to end, with a session ────────────────────────────────
    if (app && session?.token) {
      out.push(
        await runProbe(
          { id: "speech.api_tts.authed", layer: "speech", title: "/api/tts returns audio to a signed-in caller", expected: [STATUS.LIVE] },
          async () => {
            const { res, ms } = await fetchRetry(
              `${app}/api/tts`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.token}` },
                body: JSON.stringify({ text: "Your wheat needs water this week", locale: "en" }),
              },
              { retries: 0, timeoutMs: 120_000 }
            );
            if (!res) return { status: STATUS.FAIL, ms, verdict: "unreachable" };
            const ct = res.headers.get("content-type") ?? "";
            if (res.status === 503) {
              return { status: STATUS.ABSENT, ms, evidence: { status: 503 }, verdict: "503 — the documented no-server degradation" };
            }
            const buf = res.ok ? Buffer.from(await res.arrayBuffer()) : null;
            return {
              status: res.ok && ct.includes("audio") ? STATUS.LIVE : STATUS.FAIL,
              ms,
              evidence: { status: res.status, contentType: ct, bytes: buf?.length ?? 0 },
              verdict: res.ok ? `${res.status} ${ct}, ${buf?.length ?? 0} bytes in ${ms}ms` : `${res.status}`,
            };
          }
        )
      );
    }
  } finally {
    if (user?.id) {
      if (seeded && session?.client) {
        await teardown(session.client, {
          profileIds: [seeded.profileId],
          farmByProfile: { [seeded.profileId]: seeded.farmId },
          userIds: [],
        }).catch(() => {});
      }
      const ok = await deleteUser(user.id).catch(() => false);
      out.push(
        await runProbe(
          { id: "speech.teardown", layer: "speech", title: "Speech throwaway account removed", expected: [STATUS.LIVE] },
          async () => ({
            status: ok ? STATUS.LIVE : STATUS.FAIL,
            ms: 0,
            evidence: { userId: user.id, deleted: ok },
            verdict: ok ? "account deleted" : "DELETE failed — see out/orphans.json",
          })
        )
      );
    }
  }

  return out;
}
