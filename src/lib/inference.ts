/**
 * Where the optional Python inference server lives, if anywhere.
 *
 * `ml/server.py` serves the PlantVillage disease classifier and MMS-TTS. It is
 * a long-lived FastAPI process holding hundreds of megabytes of model weights,
 * so it cannot run inside a Vercel serverless function — it has to be hosted
 * separately, and often simply is not running at all. Both callers already
 * degrade gracefully (disease falls back to the Groq vision model, TTS to
 * showing the reply as text), so "absent" is a normal state, not a fault.
 *
 * The default only makes sense on a developer's machine, where the server is
 * started by hand on port 8008. In a deployed environment there is nothing on
 * localhost, and dialling it on every request just buys a guaranteed connection
 * refusal. So the default applies locally and is dropped once VERCEL is set —
 * an explicit INFERENCE_URL always wins, which is how you point a deployment at
 * a real host.
 */
export function inferenceBaseUrl(): string | null {
  const explicit = process.env.INFERENCE_URL?.trim();
  if (explicit) return explicit.replace(/\/+$/, "");

  // process.env.VERCEL is "1" on every Vercel build and runtime.
  if (process.env.VERCEL) return null;

  return "http://127.0.0.1:8008";
}
