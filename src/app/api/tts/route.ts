import { getSessionFarmer } from "@/lib/auth";
import { ttsBaseUrl } from "@/lib/inference";
import { checkRateLimit, rateLimited } from "@/lib/rateLimit";
import { maxSpeechSeconds, speakableFor, trimWav, wavSeconds } from "@/lib/speechText";

export const dynamic = "force-dynamic";


/**
 * Matches MAX_TTS_CHARS in ml/tts/server.py, so a long chunk is refused here
 * rather than silently truncated mid-sentence there. The client sends chunks of
 * at most ~160 characters, so this is only ever a backstop.
 */
const MAX_CHARS = 600;

/**
 * NVIDIA's hosted Magpie TTS (build.nvidia.com), over its HTTP API. It speaks
 * English and Hindi — the two locales with an entry here — and needs no GPU of
 * our own, so it is what makes the assistant audible on Vercel. Same
 * NVIDIA_API_KEY as src/lib/translate.ts.
 */
const NVIDIA_TTS_URL =
  "https://877104f7-e885-42b9-8de8-f6e4c6303969.invocation.api.nvcf.nvidia.com/v1/audio/synthesize";
const NVIDIA_LANGUAGE: Record<string, { code: string; voiceTag: string }> = {
  en: { code: "en-US", voiceTag: "EN-US" },
  hi: { code: "hi-IN", voiceTag: "HI-IN" },
};
/** Speaker name; "Aria" exists in both the EN-US and HI-IN voice sets. */
const NVIDIA_SPEAKER = process.env.NVIDIA_TTS_VOICE?.trim() || "Aria";

/**
 * The "dampened relaxation" voice: a slightly slower, lower-pitched delivery so
 * the assistant sounds calm and warm to a farmer rather than brisk and robotic.
 * Magpie honours SSML <prosody> but only a percentage `rate` and an Hz (or named)
 * `pitch` — not semitones, not a percentage pitch (confirmed against the live
 * endpoint). Tunable without a deploy via NVIDIA_TTS_RATE / NVIDIA_TTS_PITCH.
 */
const NVIDIA_RATE = process.env.NVIDIA_TTS_RATE?.trim() || "88%";
const NVIDIA_PITCH = process.env.NVIDIA_TTS_PITCH?.trim() || "-25Hz";

function calmSsml(text: string): string {
  const esc = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return `<speak><prosody rate="${NVIDIA_RATE}" pitch="${NVIDIA_PITCH}">${esc}</prosody></speak>`;
}

/** The self-hosted Chatterbox server, or null when it is absent or fails. */
async function chatterbox(baseUrl: string, text: string, locale: string): Promise<ArrayBuffer | null> {
  try {
    const res = await fetch(`${baseUrl}/tts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, locale }),
      // One sentence-sized chunk. The server warms the model at startup, but
      // a busy GPU queues requests, so leave generous headroom.
      signal: AbortSignal.timeout(90_000),
    });
    if (!res.ok) {
      console.error("TTS server error:", res.status);
      return null;
    }
    return await res.arrayBuffer();
  } catch (e) {
    // Not running, or timed out. Expected on Vercel and on most laptops.
    console.warn("TTS server unreachable:", (e as Error)?.message ?? e);
    return null;
  }
}

/** NVIDIA hosted speech, or null when there is no key, no voice for the locale, or it fails. */
async function nvidiaSpeech(text: string, locale: string): Promise<ArrayBuffer | null> {
  const key = process.env.NVIDIA_API_KEY;
  const lang = NVIDIA_LANGUAGE[locale];
  if (!key || !lang) return null;

  const call = (body: string) => {
    const form = new FormData();
    form.set("text", body);
    form.set("language", lang.code);
    form.set("voice", `Magpie-Multilingual.${lang.voiceTag}.${NVIDIA_SPEAKER}`);
    form.set("encoding", "LINEAR_PCM");
    form.set("sample_rate_hz", "22050");
    return fetch(NVIDIA_TTS_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}` },
      body: form,
      signal: AbortSignal.timeout(30_000),
    });
  };

  try {
    // Speak it calm (SSML prosody). If the endpoint ever rejects the SSML, fall
    // straight back to the plain text so a reply is never lost over styling.
    let res = await call(calmSsml(text));
    if (res.status === 400) res = await call(text);
    // The free tier allows ~40 requests a minute, and one long reply is
    // several chunks. One short wait beats a reply that falls silent midway.
    if (res.status === 429) {
      const wait = Math.min(3, Number(res.headers.get("retry-after")) || 1.5);
      await new Promise((r) => setTimeout(r, wait * 1000));
      res = await call(calmSsml(text));
      if (res.status === 400) res = await call(text);
    }
    if (!res.ok) {
      console.error("NVIDIA TTS error:", res.status, (await res.text().catch(() => "")).slice(0, 200));
      return null;
    }
    return await res.arrayBuffer();
  } catch (e) {
    console.error("NVIDIA TTS unreachable:", (e as Error)?.message ?? e);
    return null;
  }
}

/**
 * Speech synthesis for the assistant: every spoken reply and the onboarding
 * read-aloud come through here, one sentence-sized chunk per request.
 *
 * Two voices, tried in order:
 *   1. The Chatterbox Indic LoRA model in `ml/tts/server.py`, when it is
 *      running (Malayalam and Punjabi fall back to MMS-TTS there, since
 *      Chatterbox cannot speak them). Covers all nine locales.
 *   2. NVIDIA's hosted Magpie voice, for English and Hindi, when
 *      NVIDIA_API_KEY is set. Needs no GPU, so it works on Vercel.
 *
 * A 503 here is expected and not an error state: speech is optional, and the
 * client falls back to showing the reply as text when neither voice answers.
 */
export async function POST(req: Request) {
  // Counted before any work is done — the point is to refuse the expensive
  // call, not to do it and then complain.
  const rl = await checkRateLimit(req, "tts");
  if (!rl.ok) return rateLimited(rl);

  const farmer = await getSessionFarmer();
  if (!farmer) {
    return new Response("Not signed in.", { status: 401 });
  }

  let text = "";
  let locale = "en";
  try {
    const body = await req.json();
    text = typeof body?.text === "string" ? body.text.trim().slice(0, MAX_CHARS) : "";
    if (typeof body?.locale === "string") locale = body.locale;
  } catch {
    return new Response("Invalid request.", { status: 400 });
  }

  text = speakableFor(text, locale);
  if (!text) return new Response("No text supplied.", { status: 400 });

  const serverUrl = ttsBaseUrl();
  const synthesize = async () =>
    (serverUrl ? await chatterbox(serverUrl, text, locale) : null) ?? (await nvidiaSpeech(text, locale));

  // Neural TTS occasionally loses its place and repeats a syllable until it
  // hits its own length limit — a farmer heard "हल्का" for 50 seconds. Audio
  // far longer than the text could need is regenerated once, then cut.
  const cap = maxSpeechSeconds(text);
  let audio = await synthesize();
  if (audio && (wavSeconds(audio) ?? 0) > cap) {
    console.warn(`TTS ran long (${wavSeconds(audio)?.toFixed(1)}s for ${text.length} chars); retrying`);
    const retry = await synthesize();
    audio = retry && (wavSeconds(retry) ?? 0) <= cap ? retry : trimWav(retry ?? audio, cap);
  }

  if (!audio) {
    // 503 is the contract the client already understands: it falls back to
    // the reply as text, silently.
    return new Response("Speech synthesis is not available.", { status: 503 });
  }

  return new Response(audio, {
    headers: {
      "Content-Type": "audio/wav",
      "Content-Length": String(audio.byteLength),
      // The same reply gets replayed often; let the browser keep it.
      "Cache-Control": "private, max-age=3600",
    },
  });
}
