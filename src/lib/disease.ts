import "server-only";
import { GROQ_TEXT_MODEL } from "@/lib/http";
import { groqFetch, safeParseJson, VISION_MODEL } from "@/lib/groqVision";

export type DiseaseResult = {
  source: "model" | "vision";
  crop: string;
  disease: string;
  healthy: boolean;
  confidence: number; // 0..1
  severity: "Low" | "Medium" | "High";
  affectedAreaPct: number;
  summary: string;
  treatment: { organic: string[]; chemical: string[] };
  recovery: string;
  prevention: string[];
  note?: string;
};

const NARRATIVE_SHAPE = `{
  "severity": "Low" | "Medium" | "High",
  "affectedAreaPct": number,
  "summary": "one concise sentence",
  "treatment": { "organic": ["short step", "short step"], "chemical": ["short step", "short step"] },
  "recovery": "e.g. 2-3 weeks with treatment",
  "prevention": ["short tip", "short tip"]
}`;

/** High-confidence path: the classifier already named the disease; Groq writes the plan. */
export async function narrativeFromLabel(crop: string, disease: string): Promise<Partial<DiseaseResult>> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error("Missing GROQ_API_KEY");

  const healthy = disease.toLowerCase() === "healthy";
  const prompt = healthy
    ? `A ${crop} leaf was analysed and looks HEALTHY. Return JSON ${NARRATIVE_SHAPE} with severity "Low", affectedAreaPct 0, an encouraging summary, empty treatment arrays, recovery "N/A", and 2 short prevention/maintenance tips. Indian agriculture context. JSON only.`
    : `A ${crop} plant has "${disease}". Give a practical treatment plan for an Indian farmer. Return ONLY JSON in this exact shape: ${NARRATIVE_SHAPE}. Use ₹ where relevant. Keep every string short. JSON only, no prose.`;

  const data = await groqFetch(
    apiKey,
    {
      model: GROQ_TEXT_MODEL,
      messages: [
        { role: "system", content: "You are a plant pathologist. Return valid JSON only." },
        { role: "user", content: prompt },
      ],
      temperature: 0.3,
    },
    "narrative"
  );
  const raw = data?.choices?.[0]?.message?.content;
  if (!raw) throw new Error(`Empty narrative response: ${JSON.stringify(data).slice(0, 300)}`);
  return safeParseJson(raw);
}

/** Fallback path: classifier is unsure or crop is out-of-distribution — use Groq vision on the image. */
export async function diagnoseFromImage(dataUrl: string): Promise<DiseaseResult> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error("Missing GROQ_API_KEY");

  const shape = `{
  "crop": "best guess of the plant/crop",
  "disease": "disease name, or 'Healthy', or 'Uncertain'",
  "healthy": boolean,
  "confidence": number between 0 and 1,
  "severity": "Low" | "Medium" | "High",
  "affectedAreaPct": number,
  "summary": "one concise sentence",
  "treatment": { "organic": ["short step"], "chemical": ["short step"] },
  "recovery": "e.g. 2-3 weeks",
  "prevention": ["short tip", "short tip"]
}`;

  const data = await groqFetch(
    apiKey,
    {
      model: VISION_MODEL,
      // Qwen3.6 is a reasoning model: without this it spends the whole token budget
      // inside <think> and returns truncated, unparseable JSON.
      reasoning_effort: "none",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `You are a plant pathologist. Look at this leaf photo and diagnose it for an Indian farmer. If you can't tell, set disease to "Uncertain" and low confidence — do not invent. Return ONLY JSON: ${shape}`,
            },
            { type: "image_url", image_url: { url: dataUrl } },
          ],
        },
      ],
      temperature: 0.2,
      // Headroom for the model's reasoning pass — see GROQ_TEXT_MODEL.
      max_tokens: 2500,
    },
    "vision"
  );

  const raw = data?.choices?.[0]?.message?.content;
  if (!raw) throw new Error(`Empty vision response: ${JSON.stringify(data).slice(0, 300)}`);
  const parsed = safeParseJson(raw);
  return {
    source: "vision",
    crop: String(parsed.crop ?? "Unknown"),
    disease: String(parsed.disease ?? "Uncertain"),
    healthy: Boolean(parsed.healthy),
    confidence: Number(parsed.confidence ?? 0.5),
    severity: (parsed.severity ?? "Medium") as DiseaseResult["severity"],
    affectedAreaPct: Number(parsed.affectedAreaPct ?? 0),
    summary: String(parsed.summary ?? ""),
    treatment: {
      organic: parsed.treatment?.organic ?? [],
      chemical: parsed.treatment?.chemical ?? [],
    },
    recovery: String(parsed.recovery ?? ""),
    prevention: parsed.prevention ?? [],
    note: "Diagnosed by AI vision (crop outside the trained model's classes).",
  };
}
