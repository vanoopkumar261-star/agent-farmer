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
  if (!apiKey)
    return NextResponse.json({ error: "AI not configured" }, { status: 500 });

  try {
    const { prices, farmerCrops, locale, unavailableCrops, state } =
      await req.json();

    const language = aiLanguageName(locale ?? "en");

    const availablePrices = (prices ?? []).filter(
      (p: any) => !p.notAvailable && p.price > 0
    );

    const unavailableNames: string[] = unavailableCrops ?? [];

    const shape = `{
  "headline": "one short sentence overview",
  "recommendations": [
    { "crop": "name", "action": "Sell now" | "Hold" | "Wait", "reason": "short reason", "confidence": number 0-100 }
  ]
}`;

    const prompt = `You are an agri-market analyst for Indian farmers.
Write "headline" and each "reason" in ${language}; keep "action" and "crop" names as given.

${state ? `Farmer location: ${state}, India.` : ""}

Current live mandi prices (₹/quintal) available today:
${
  availablePrices.length > 0
    ? availablePrices
        .map(
          (p: any) =>
            `- ${p.name}: ₹${p.price} (${p.change >= 0 ? "+" : ""}${p.change}% today, demand ${p.demand})`
        )
        .join("\n")
    : "No live prices available today."
}

${
  unavailableNames.length > 0
    ? `Crops NOT arriving at ${state ?? "local"} mandis today (DO NOT recommend selling these):
${unavailableNames.map((n) => `- ${n}`).join("\n")}`
    : ""
}

The farmer grows: ${(farmerCrops ?? []).join(", ") || "unknown crops"}.

IMPORTANT RULES:
- Only recommend crops that have live prices listed above.
- Never recommend selling ${unavailableNames.join(", ") || "unavailable crops"} — they are not at mandis today.
- If farmer's crops are all unavailable, give general advice about the available crops instead.
- Keep reasons under 15 words.

Return ONLY valid JSON matching this shape: ${shape}`;

    const res = await fetch(GROQ_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "llama-3.1-8b-instant",
        messages: [
          {
            role: "system",
            content:
              "You are a precise agri-market analyst. Return valid JSON only. Never recommend crops not currently at mandis.",
          },
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
    return NextResponse.json(
      { error: e?.message ?? "Advice failed" },
      { status: 500 }
    );
  }
}