import { getSessionFarmer } from "@/lib/auth";
import { iso639 } from "@/lib/speech";
import { fetchWithRetry } from "@/lib/http";
import { checkRateLimit, rateLimited } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

/** Groq rejects large uploads anyway; refuse early rather than proxy 40 MB. */
const MAX_BYTES = 10 * 1024 * 1024;

/** Container magic bytes we accept — the declared MIME is not trusted. */
function sniffAudio(head: Uint8Array): boolean {
  const ascii = (o: number, s: string) => {
    for (let i = 0; i < s.length; i++) {
      if (head[o + i] !== s.charCodeAt(i)) return false;
    }
    return true;
  };
  // WebM / Matroska (EBML)
  if (head[0] === 0x1a && head[1] === 0x45 && head[2] === 0xdf && head[3] === 0xa3) return true;
  // Ogg
  if (ascii(0, "OggS")) return true;
  // WAV (RIFF....WAVE)
  if (ascii(0, "RIFF") && ascii(8, "WAVE")) return true;
  // MP3 (ID3 tag, or a frame sync)
  if (ascii(0, "ID3")) return true;
  if (head[0] === 0xff && (head[1] & 0xe0) === 0xe0) return true;
  // MP4 / M4A (....ftyp)
  if (ascii(4, "ftyp")) return true;
  return false;
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

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
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
  if (!sniffAudio(head)) {
    return Response.json({ error: "That doesn't look like an audio recording." }, { status: 415 });
  }

  const upstream = new FormData();
  upstream.append("file", audio, "speech.webm");
  upstream.append("model", "whisper-large-v3-turbo");
  upstream.append("language", iso639(locale));
  upstream.append("response_format", "json");
  // Nudges the model toward this app's subject matter, which measurably helps
  // with crop and scheme names in short clips.
  upstream.append("prompt", "Indian farming: crops, soil, irrigation, mandi prices, weather.");

  try {
    const res = await fetchWithRetry("https://api.groq.com/openai/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: upstream,
    }, { label: "groq/transcribe" });

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      console.error("GROQ transcribe error:", res.status, detail);
      return Response.json(
        { error: "Could not transcribe that. Please try again." },
        { status: 502 }
      );
    }

    const data = await res.json();
    return Response.json({ text: (data?.text ?? "").trim() });
  } catch (e) {
    console.error("GROQ transcribe error:", e);
    return Response.json({ error: "Could not reach the voice service." }, { status: 502 });
  }
}
