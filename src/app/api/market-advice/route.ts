import { NextResponse } from "next/server";
import { aiLanguageName } from "@/lib/i18n/config";

export const dynamic = "force-dynamic";

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

function safeParse(raw: string): any {
  const cleaned = raw.replace(/```json/gi, "").replace(/```/g, "").trim();
  const a = cleaned.indexOf("{");
  const b = cleaned.lastIndexOf("}");
  if (a === -1 || b === -1) throw new Error("No JSON");
  return JSON.parse(cleaned.slice(a, b + 1));
}

export async function POST(req: Request) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "AI not configured" }, { status: 500 });

  try {
    const { prices, farmerCrops, locale } = await req.json();
    const language = aiLanguageName(locale ?? "en");

    const shape = `{
  "headline": "one short sentence overview",
  "recommendations": [
    { "crop": "name", "action": "Sell now" | "Hold" | "Wait", "reason": "short reason", "confidence": number 0-100 }
  ]
}`;

    const prompt = `You are an agri-market analyst for Indian farmers. Write "headline" and each "reason" in ${language}; keep the "action" value and "crop" names as given.
Current mandi prices (₹/quintal) and 21-day trend direction:
${(prices ?? []).map((p: any) => `- ${p.name}: ₹${p.price} (${p.change >= 0 ? "+" : ""}${p.change}% today, demand ${p.demand})`).join("\n")}

The farmer is currently growing: ${(farmerCrops ?? []).join(", ") || "unknown"}.

Give a concise selling-window recommendation. Prioritise the crops the farmer grows. Return ONLY JSON: ${shape}. Keep reasons under 15 words. JSON only.`;

    const res = await fetch(GROQ_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "llama-3.1-8b-instant",
        messages: [
          { role: "system", content: "You are a precise agri-market analyst. Return valid JSON only." },
          { role: "user", content: prompt },
        ],
        temperature: 0.3,
      }),
    });

    const data = await res.json();
    const raw = data?.choices?.[0]?.message?.content;
    if (!raw) throw new Error("Empty response");
    return NextResponse.json(safeParse(raw));
  } catch (e: any) {
    console.error("MARKET advice error:", e);
    return NextResponse.json({ error: e?.message ?? "Advice failed" }, { status: 500 });
  }
}
