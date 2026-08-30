import "server-only";
import { fetchWithRetry } from "@/lib/http";

/**
 * Shared plumbing for the Groq multimodal calls (disease diagnosis, pH-meter
 * reading). Kept separate from any one feature so a new "look at this photo and
 * tell me X" endpoint reuses the retry/parse behaviour instead of re-deriving it.
 */

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

/** The only multimodal model on the current Groq tier. Override if that changes. */
export const VISION_MODEL = process.env.GROQ_VISION_MODEL ?? "qwen/qwen3.6-27b";

/**
 * POST to Groq and return the parsed body. Surfaces the API's own error text
 * instead of letting a missing `choices` array turn into a meaningless "empty
 * response", and rides out the 429/503 the on-demand tier hands back under load.
 */
export async function groqFetch(apiKey: string, body: unknown, label: string): Promise<any> {
  let lastErr = "";
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetchWithRetry(
      GROQ_URL,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify(body),
      },
      { label: `groq/${label}` }
    );
    if (res.ok) return res.json();

    lastErr = (await res.text()).slice(0, 300);
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
