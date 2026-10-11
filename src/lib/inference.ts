/**
 * Where the optional Python inference server lives, if anywhere.
 *
 * `ml/server.py` serves the PlantVillage disease classifier. It is
 * a long-lived FastAPI process holding hundreds of megabytes of model weights,
 * so it cannot run inside a Vercel serverless function — it has to be hosted
 * separately, and often simply is not running at all. Both callers already
 * degrade gracefully (disease falls back to the Groq vision model, TTS to
 * showing the reply as text), so "absent" is a normal state, not a fault.
 * (Speech has its own server and URL — see ttsBaseUrl below.)
 *
 * The default only makes sense on a developer's machine, where the server is
 * started by hand on port 8008. In a deployed environment there is nothing on
 * localhost, and dialling it on every request just buys a guaranteed connection
 * refusal. So the default applies locally and is dropped once VERCEL is set —
 * an explicit INFERENCE_URL always wins, which is how you point a deployment at
 * a real host.
 */
/**
 * Where the speech server lives (`ml/tts/server.py`, Chatterbox Indic).
 *
 * Separate from the disease server because it needs a different Python
 * environment (numpy<2, a CUDA torch) and a GPU of its own, so in production the
 * two will not share a host. Same local-only default rule as above: an explicit
 * TTS_URL always wins, and on Vercel with none set there is simply no voice.
 */
export function ttsBaseUrl(): string | null {
  const explicit = process.env.TTS_URL?.trim();
  if (explicit) return explicit.replace(/\/+$/, "");
  if (process.env.VERCEL) return null;
  return "http://127.0.0.1:8009";
}

export function inferenceBaseUrl(): string | null {
  const explicit = process.env.INFERENCE_URL?.trim();
  if (explicit) return explicit.replace(/\/+$/, "");

  // process.env.VERCEL is "1" on every Vercel build and runtime.
  if (process.env.VERCEL) return null;

  return "http://127.0.0.1:8008";
}
