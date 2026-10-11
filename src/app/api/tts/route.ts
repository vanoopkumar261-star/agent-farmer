import { getSessionFarmer } from "@/lib/auth";
import { ttsBaseUrl } from "@/lib/inference";
import { checkRateLimit, rateLimited } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";


/**
 * Matches MAX_TTS_CHARS in ml/tts/server.py, so a long chunk is refused here
 * rather than silently truncated mid-sentence there. The client sends chunks of
 * at most ~160 characters, so this is only ever a backstop.
 */
const MAX_CHARS = 600;

/**
 * Speech synthesis for the assistant: every spoken reply and the onboarding
 * read-aloud come through here, one sentence-sized chunk per request.
 *
 * The voice is the Chatterbox Indic LoRA model running in `ml/tts/server.py`
 * (Malayalam and Punjabi fall back to MMS-TTS there, since Chatterbox cannot
 * speak them). This route only authenticates, rate-limits and proxies.
 *
 * A 503 here is expected and not an error state: the speech server is optional,
 * and the client falls back to showing the reply as text when it is not running.
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

  if (!text) return new Response("No text supplied.", { status: 400 });

  const inferenceUrl = ttsBaseUrl();
  if (!inferenceUrl) {
    // No speech server in this environment. 503 is the contract the client
    // already understands: it falls back to the reply as text, silently.
    return new Response("Speech synthesis is not available.", { status: 503 });
  }

  try {
    const res = await fetch(`${inferenceUrl}/tts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, locale }),
      // One sentence-sized chunk. The server warms the model at startup, but
      // a busy GPU queues requests, so leave generous headroom.
      signal: AbortSignal.timeout(90_000),
    });

    if (!res.ok) {
      console.error("TTS server error:", res.status);
      return new Response("Speech synthesis unavailable.", { status: 503 });
    }

    const audio = await res.arrayBuffer();
    return new Response(audio, {
      headers: {
        "Content-Type": "audio/wav",
        "Content-Length": String(audio.byteLength),
        // The same reply gets replayed often; let the browser keep it.
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (e) {
    // Server not running, or the request timed out. Both mean "no speech" —
    // the app keeps working, it just shows the reply instead of saying it.
    console.error("TTS server unreachable:", e);
    return new Response("Speech synthesis unavailable.", { status: 503 });
  }
}
