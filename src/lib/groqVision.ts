import "server-only";
import { fetchWithRetry } from "@/lib/http";

/**
 * Shared plumbing for the Groq multimodal calls (disease diagnosis, pH-meter
 * reading). Kept separate from any one feature so a new "look at this photo and
 * tell me X" endpoint reuses the retry/parse behaviour instead of re-deriving it.
 */

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

const GROQ_MODELS_URL = "https://api.groq.com/openai/v1/models";

/**
 * The multimodal model the vision features ask for.
 *
 * Groq retires vision models often enough that a stale default is a recurring
 * outage: on 2026-10-22 `qwen/qwen3.6-27b` started returning 404 "model does
 * not exist", which killed disease diagnosis and the pH-meter read on the
 * deployed site while the local CNN path kept working, so nothing else looked
 * broken. Set GROQ_VISION_MODEL to override without a code change.
 */
export const VISION_MODEL = process.env.GROQ_VISION_MODEL ?? "qwen/qwen3.8-27b";

/**
 * Resolved substitute for a retired vision model, cached for the life of the
 * process so one 404 costs one extra round-trip rather than one per request.
 */
let discoveredModel: string | null = null;

/**
 * Asks Groq which models can actually accept an image.
 *
 * This is an exact lookup, not a guess: every entry in `/v1/models` carries
 * `input_modalities`, so the multimodal ones can be named rather than inferred
 * from the id. Returns null if the list is unreachable or has nothing visual,
 * leaving the caller to surface the original 404.
 */
async function discoverVisionModel(apiKey: string, rejected: string): Promise<string | null> {
  if (discoveredModel && discoveredModel !== rejected) return discoveredModel;
  try {
    const res = await fetchWithRetry(
      GROQ_MODELS_URL,
      { headers: { Authorization: `Bearer ${apiKey}` } },
      { label: "groq/models" }
    );
    if (!res.ok) return null;
    const list: any = await res.json();
    const match = (list?.data ?? []).find(
      (m: any) =>
        m?.active !== false &&
        m?.id !== rejected &&
        Array.isArray(m?.input_modalities) &&
        m.input_modalities.includes("image")
    );
    discoveredModel = match?.id ?? null;
    if (discoveredModel) {
      console.warn(
        `[groq] vision model "${rejected}" is retired; falling back to "${discoveredModel}". Set GROQ_VISION_MODEL to make this permanent.`
      );
    }
    return discoveredModel;
  } catch {
    return null;
  }
}

/** True for the "model does not exist or you do not have access" rejection. */
function isRetiredModel(status: number, bodyText: string): boolean {
  if (status !== 404 && status !== 400) return false;
  return /model_not_found|does not exist/i.test(bodyText);
}

/**
 * POST to Groq and return the parsed body. Surfaces the API's own error text
 * instead of letting a missing `choices` array turn into a meaningless "empty
 * response", and rides out the 429/503 the on-demand tier hands back under load.
 */
export async function groqFetch(apiKey: string, body: unknown, label: string): Promise<any> {
  let lastErr = "";
  let payload = body;
  let swappedModel = false;
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetchWithRetry(
      GROQ_URL,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify(payload),
      },
      { label: `groq/${label}` }
    );
    if (res.ok) return res.json();

    lastErr = (await res.text()).slice(0, 300);

    // A retired model is a permanent 404, so retrying the same body is pointless
    // — but the tier almost always still has *a* multimodal model. Swap in
    // whichever one Groq currently advertises and try once more, so a retirement
    // degrades to a slower first request instead of a dead feature.
    const requested = (payload as any)?.model;
    if (!swappedModel && typeof requested === "string" && isRetiredModel(res.status, lastErr)) {
      const replacement = await discoverVisionModel(apiKey, requested);
      if (replacement) {
        payload = { ...(payload as object), model: replacement };
        swappedModel = true;
        continue;
      }
    }

    if (res.status !== 429 && res.status !== 503) {
      throw new Error(`Groq ${label} ${res.status}: ${lastErr}`);
    }
    const retryAfter = Number(res.headers.get("retry-after")) || 2 * (attempt + 1);
    await new Promise((r) => setTimeout(r, Math.min(retryAfter, 10) * 1000));
  }
  throw new Error(`Groq ${label} unavailable after retries: ${lastErr}`);
}

/** Pulls the first `{...}` object out of a model reply, tolerating code fences. */
export function safeParseJson(raw: string): any {
  const cleaned = raw.replace(/```json/gi, "").replace(/```/g, "").trim();
  const a = cleaned.indexOf("{");
  const b = cleaned.lastIndexOf("}");
  if (a === -1 || b === -1) throw new Error("No JSON in model output");
  return JSON.parse(cleaned.slice(a, b + 1));
}
