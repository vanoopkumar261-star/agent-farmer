import "server-only";
import { groqFetch, safeParseJson, VISION_MODEL } from "@/lib/groqVision";

export type PhReadingResult = {
  /** 0..14, or null when the model could not read the display confidently. */
  ph: number | null;
  /** The model's confidence in its own read, 0..1. */
  confidence: number;
  /** The exact characters the model says are on the display, for the farmer to sanity-check. */
  rawText: string;
  /** Set only when something is off — unclear display, wrong quantity shown, no pH visible. */
  note: string;
};

const PROMPT = `This photo shows a handheld soil or water pH meter's digital display. \
Read the pH value shown on the screen.

Return ONLY JSON, no prose:
{
  "ph": <the pH number 0-14 exactly as shown, or null if you cannot read it clearly>,
  "confidence": <your confidence in that read, 0 to 1>,
  "rawText": "<the exact digits and characters visible on the display>",
  "note": "<a short note ONLY if the display is blurry, shows a different quantity (temperature, EC, TDS, moisture), or no pH is visible — otherwise empty string>"
}

Never guess. If you are not sure of the number, set "ph" to null. A wrong pH is worse than no pH.`;

const clamp01 = (n: number) => (Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0.5);

/**
 * Reads a pH value off a photo of a meter's display via Groq vision.
 * Mirrors `diagnoseFromImage` in src/lib/disease.ts.
 */
export async function readPhFromImage(dataUrl: string): Promise<PhReadingResult> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error("Missing GROQ_API_KEY");

  const data = await groqFetch(
    apiKey,
    {
      model: VISION_MODEL,
      // Qwen3.6 is a reasoning model: without this it burns the token budget in
      // <think> and returns truncated JSON. See src/lib/disease.ts.
      reasoning_effort: "none",
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: PROMPT },
            { type: "image_url", image_url: { url: dataUrl } },
          ],
        },
      ],
      temperature: 0.1,
      max_tokens: 800,
    },
    "ph"
  );

  const raw = data?.choices?.[0]?.message?.content;
  if (!raw) throw new Error(`Empty pH-reading response: ${JSON.stringify(data).slice(0, 300)}`);
  const parsed = safeParseJson(raw);

  let ph: number | null = Number(parsed.ph);
  if (!Number.isFinite(ph) || (ph as number) < 0 || (ph as number) > 14) {
    ph = null;
  } else {
    ph = Math.round((ph as number) * 10) / 10;
  }

  return {
    ph,
    confidence: clamp01(Number(parsed.confidence ?? 0.5)),
    rawText: String(parsed.rawText ?? "").slice(0, 60),
    note: String(parsed.note ?? "").slice(0, 300),
  };
}
