import "server-only";
import { SUPPORTED_CROPS } from "./agronomy";

export type FarmInput = {
  area: number;
  soilType: string;
  irrigation: string;
};

export type CropRec = {
  cropName: string;
  suitabilityScore: number;
  confidenceScore: number;
  riskScore: "Low" | "Medium" | "High";
  pros: string[];
  cons: string[];
  estimatedYield: string;
  estimatedProfit: string;
};

export type RecommendationResponse = {
  farms: CropRec[][];
};

export async function getCropRecommendations(params: {
  locationAddress: string;
  farms: FarmInput[];
  /** Set when the farmer acknowledged the oilseed awareness page. */
  preferOilseed?: boolean;
}): Promise<RecommendationResponse> {

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error("Missing GROQ_API_KEY");

  const { locationAddress, farms, preferOilseed = false } = params;

  // Suitability still decides. The acknowledgement only asks the model to give
  // an oilseed a fair look where one genuinely fits — never to force one onto
  // land it doesn't suit.
  const oilseedDirective = preferOilseed
    ? `
This farmer has asked to consider oilseed crops.
For each farm, include ONE oilseed crop (mustard/rapeseed, groundnut, soybean,
sesame, sunflower, castor, safflower, linseed or niger) among the 3
recommendations — but ONLY where it is genuinely agronomically suitable for that
farm's soil, irrigation, region and season. If no oilseed is suitable for a
farm, recommend the best-suited crops instead and do NOT force an oilseed.
Score every crop honestly on its own merits.
`.trim()
    : "";

  // The agronomy engine only holds cycle length, yield and heat thresholds for
  // this list, and the onboarding cards only have photographs for it. A crop
  // outside it silently fell back to a generic 120-day cycle and a blank card,
  // so the model is held to the same vocabulary the rest of the app knows.
  const allowed = SUPPORTED_CROPS.join(", ");

  const prompt = `
Farmer location: "${locationAddress}"

Farms:
${JSON.stringify(farms, null, 2)}

For EACH farm generate 3 crop recommendations.

You MUST choose cropName from this list, spelled exactly as written:
${allowed}
Never invent a crop outside this list. If an ideal crop is missing, pick the
closest suitable one that IS listed.
${oilseedDirective}

Return JSON strictly in this format:

{
  "farms": [
    [
      {
        "cropName": "string",
        "suitabilityScore": number,
        "confidenceScore": number,
        "riskScore": "Low" | "Medium" | "High",
        "pros": ["string"],
        "cons": ["string"],
        "estimatedYield": "string",
        "estimatedProfit": "string"
      }
    ]
  ]
}

ONLY JSON.
NO explanation.
`.trim();

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: "llama-3.1-8b-instant",
      messages: [
        { role: "system", content: "Return valid JSON only. No explanations." },
        { role: "user", content: prompt }
      ],
      temperature: 0.3
    })
  });

  const data = await res.json();

  const raw = data?.choices?.[0]?.message?.content;
  if (!raw) throw new Error("Groq returned empty response");

  // Extract JSON block safely
  const cleaned = raw
    .replace(/```json/gi, "")
    .replace(/```/g, "")
    .trim();

  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");
  if (firstBrace === -1 || lastBrace === -1) {
    throw new Error("Invalid JSON returned from AI");
  }

  const jsonString = cleaned.slice(firstBrace, lastBrace + 1);

  const parsed = JSON.parse(jsonString);

  return parsed as RecommendationResponse;
}