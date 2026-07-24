import "server-only";

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
}): Promise<RecommendationResponse> {

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error("Missing GROQ_API_KEY");

  const { locationAddress, farms } = params;

  const prompt = `
Farmer location: "${locationAddress}"

Farms:
${JSON.stringify(farms, null, 2)}

For EACH farm generate 3 crop recommendations.

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