import { NextResponse } from "next/server";
import { aiLanguageName } from "@/lib/i18n/config";
import { fetchWithRetry, readGroqContent, GROQ_TEXT_MODEL } from "@/lib/http";
import { checkRateLimit, rateLimited } from "@/lib/rateLimit";
import { clampArr, clampStr, payloadTooLarge, PayloadTooLargeError, readJsonBounded } from "@/lib/apiInput";

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
  // Counted before any work is done — the point is to refuse the expensive
  // call, not to do it and then complain.
  const rl = await checkRateLimit(req, "market-advice");
  if (!rl.ok) return rateLimited(rl);

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey)
    return NextResponse.json({ error: "AI not configured" }, { status: 500 });

  try {
    let input: any;
    try {
      input = await readJsonBounded(req, 16_000);
    } catch (e) {
      if (e instanceof PayloadTooLargeError) return payloadTooLarge();
      return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    }

    const language = aiLanguageName(typeof input?.locale === "string" ? input.locale : "en");
    const state = clampStr(input?.state, 40);
    const farmerCrops = clampArr<unknown>(input?.farmerCrops, 20).map((c) => clampStr(c, 40)).filter(Boolean);
    const unavailableNames = clampArr<unknown>(input?.unavailableCrops, 20).map((c) => clampStr(c, 40)).filter(Boolean);

    // Price rows: keep only the fields the prompt reads, and cap the count.
    const availablePrices = clampArr<any>(input?.prices, 40)
      .filter((p) => p && !p.notAvailable && Number(p.price) > 0)
      .map((p) => ({
        name: clampStr(p.name, 40),
        price: Number(p.price) || 0,
        change: Number(p.change) || 0,
        demand: clampStr(p.demand, 20),
      }));

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

    const res = await fetchWithRetry(GROQ_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: GROQ_TEXT_MODEL,
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
    }, { label: "groq/market-advice" });

    const raw = await readGroqContent(res, "groq/market-advice");
    return NextResponse.json(safeParse(raw));
  } catch (e: any) {
    console.error("MARKET advice error:", e);
    return NextResponse.json(
      { error: e?.message ?? "Advice failed" },
      { status: 500 }
    );
  }
}