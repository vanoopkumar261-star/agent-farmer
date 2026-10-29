import { getSessionFarmer } from "@/lib/auth";
import { iso639 } from "@/lib/speech";
import { groqFetch } from "@/lib/http";
import { groqKeyPool } from "@/lib/groqKeys";
import { checkRateLimit, rateLimited } from "@/lib/rateLimit";
import { transcribePromptFor } from "@/lib/transcribePrompts";

export const dynamic = "force-dynamic";

/** Groq rejects large uploads anyway; refuse early rather than proxy 40 MB. */
const MAX_BYTES = 10 * 1024 * 1024;

/**
 * Whisper's `language` field, as both the full name and the code it may use,
 * mapped to the app's own locale codes.
 *
 * Only these nine exist in the app, so a detection outside the list is not a
 * language the app could switch to even if it wanted — it falls back to Hindi
 * below. Keys are lowercased before lookup.
 */
const SUPPORTED_SPOKEN: Record<string, string> = {
  english: "en", en: "en",
  hindi: "hi", hi: "hi",
  kannada: "kn", kn: "kn",
  tamil: "ta", ta: "ta",
  telugu: "te", te: "te",
  malayalam: "ml", ml: "ml",
  marathi: "mr", mr: "mr",
  bengali: "bn", bn: "bn",
  punjabi: "pa", pa: "pa",
};

/**
 * Container magic bytes we accept — the declared MIME is not trusted. Returns
 * the real extension so the upstream filename matches the real container:
 * Groq's (OpenAI-compatible) transcription endpoint picks a demuxer from the
 * filename extension, so labeling real M4A bytes "speech.webm" — which this
 * route did unconditionally until now — hands it the wrong decoder for every
 * mobile recording (expo-audio's HIGH_QUALITY preset is always .m4a, on both
 * Android and iOS; nothing here ever actually produces WebM).
 */
function sniffAudioExt(head: Uint8Array): string | null {
  const ascii = (o: number, s: string) => {
    for (let i = 0; i < s.length; i++) {
      if (head[o + i] !== s.charCodeAt(i)) return false;
    }
    return true;
  };
  // WebM / Matroska (EBML)
  if (head[0] === 0x1a && head[1] === 0x45 && head[2] === 0xdf && head[3] === 0xa3) return "webm";
  // Ogg
  if (ascii(0, "OggS")) return "ogg";
  // WAV (RIFF....WAVE)
  if (ascii(0, "RIFF") && ascii(8, "WAVE")) return "wav";
  // MP3 (ID3 tag, or a frame sync)
  if (ascii(0, "ID3")) return "mp3";
  if (head[0] === 0xff && (head[1] & 0xe0) === 0xe0) return "mp3";
  // MP4 / M4A (....ftyp)
  if (ascii(4, "ftyp")) return "m4a";
  return null;
}

/**
 * Speech-to-text fallback.
 *
 * The browser's own Web Speech API handles this for free in Chrome, Edge and
 * Safari, so this route only runs where that is missing — Firefox, mainly — or
 * when Web Speech errors out with a network failure. It reuses the GROQ_API_KEY
 * the assistant already needs, so voice adds no new service and no new cost.
 *
 * `whisper-large-v3-turbo` is the right model here: it handles all nine of the
 * app's languages, and passing an explicit `language` stops it guessing wrong
 * on short utterances, which is the common failure with Indic speech.
 */
export async function POST(req: Request) {
  // Counted before any work is done — the point is to refuse the expensive
  // call, not to do it and then complain.
  const rl = await checkRateLimit(req, "transcribe");
  if (!rl.ok) return rateLimited(rl);

  if (groqKeyPool().length === 0) {
    return Response.json({ error: "Voice input is not configured." }, { status: 500 });
  }

  // Same guard as /api/chat — transcription costs quota, so it is not open.
  const farmer = await getSessionFarmer();
  if (!farmer) {
    return Response.json({ error: "Not signed in." }, { status: 401 });
  }

  let audio: File | null = null;
  let locale = "en";
  try {
    const form = await req.formData();
    const file = form.get("audio");
    audio = file instanceof File ? file : null;
    const loc = form.get("locale");
    if (typeof loc === "string") locale = loc;
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }

  if (!audio || audio.size === 0) {
    return Response.json({ error: "No audio received." }, { status: 400 });
  }
  if (audio.size > MAX_BYTES) {
    return Response.json({ error: "Recording is too long." }, { status: 413 });
  }

  // The declared type is whatever the client wrote into the multipart body.
  // Check the container magic bytes instead so this can't be used as a generic
  // "post bytes to Groq" proxy.
  const head = new Uint8Array(await audio.slice(0, 16).arrayBuffer());
  const ext = sniffAudioExt(head);
  if (!ext) {
    return Response.json({ error: "That doesn't look like an audio recording." }, { status: 415 });
  }

  // English and Hindi speakers switch between the two freely, whatever the
  // app is set to. Forcing `language` to the app's setting made Whisper
  // *translate* Hindi speech into English nonsense ("prepare the meat" for
  // "मिट्टी कैसे तैयार करें") whenever the app was on English. For these two the
  // spoken language is detected instead and reported back, so the reply can
  // follow it. The other seven keep the benchmarked forced-language path.
  const detect = locale === "en" || locale === "hi";

  const transcribe = (language: string | null) => {
    const upstream = new FormData();
    upstream.append("file", audio!, `speech.${ext}`);
    upstream.append("model", "whisper-large-v3-turbo");
    if (language) upstream.append("language", language);
    upstream.append("response_format", detect ? "verbose_json" : "json");
    // Per-locale prompt strategy, chosen by a 384-call benchmark rather than
    // guessed — see transcribePromptFor()'s docstring for the measured numbers
    // and why a single English prompt broke six of the nine languages. With
    // detection on, no prompt: an English hint would tilt the guess to English.
    const prompt = detect ? undefined : transcribePromptFor(locale);
    if (prompt) upstream.append("prompt", prompt);
    return groqFetch("https://api.groq.com/openai/v1/audio/transcriptions", {
      method: "POST",
      body: upstream,
    }, { label: "groq/transcribe" });
  };

  try {
    let res = await transcribe(detect ? null : iso639(locale));
    let data = res.ok ? await res.json() : null;

    let spoken = locale;
    if (detect && data) {
      const heard = String(data.language ?? "").toLowerCase();
      const matched = SUPPORTED_SPOKEN[heard] ?? null;
      if (matched) {
        /*
          Detection used to collapse to two answers: English, or else Hindi.
          A farmer speaking Kannada into an app set to English was therefore
          transcribed as Hindi and answered in Hindi, with no way to say so —
          which is why the app's language could never follow the farmer's
          voice for seven of the nine languages.

          The first pass ran with no forced language, so it already
          transcribed whatever was actually spoken; naming it here is enough
          and costs nothing. Deliberately NOT re-transcribing with the
          benchmarked per-locale prompt: that would be a second Groq call on
          every non-Hindi utterance, and spoken latency is the thing this
          loop can least afford.
        */
        spoken = matched;
      } else {
        // Not one of the nine. Urdu is the case that matters: the same speech
        // as Hindi, filed under a script a Hindi reader cannot use, so it is
        // transcribed again as Hindi.
        spoken = "hi";
        res = await transcribe("hi");
        data = res.ok ? await res.json() : null;
      }
    }

    if (!res.ok || !data) {
      const detail = await res.text().catch(() => "");
      console.error("GROQ transcribe error:", res.status, detail);
      return Response.json(
        { error: "Could not transcribe that. Please try again." },
        { status: 502 }
      );
    }

    return Response.json({ text: (data?.text ?? "").trim(), locale: spoken });
  } catch (e) {
    console.error("GROQ transcribe error:", e);
    return Response.json({ error: "Could not reach the voice service." }, { status: 502 });
  }
}
