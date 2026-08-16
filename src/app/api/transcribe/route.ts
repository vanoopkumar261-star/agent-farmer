import { getSessionFarmer } from "@/lib/auth";
import { iso639 } from "@/lib/speech";
import { fetchWithRetry } from "@/lib/http";

export const dynamic = "force-dynamic";

/** Groq rejects large uploads anyway; refuse early rather than proxy 40 MB. */
const MAX_BYTES = 10 * 1024 * 1024;

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
