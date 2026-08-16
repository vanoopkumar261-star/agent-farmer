import { getCropProfile, normalizeCrop, STAGE_LABELS } from "@/lib/agronomy";
import { fetchWithRetry } from "@/lib/http";

export const dynamic = "force-dynamic";

/**
 * Growing guide for one crop, for this farmer's field.
 *
 * The numbers are NOT asked of the model — cycle length, stage split, yield and
 * heat threshold all come from the agronomy engine and are passed in as facts.
 * Groq only writes the prose around them. That keeps the guide consistent with
 * the countdown, tasks and health score the farmer sees later, instead of
 * quoting a different cycle length invented on the spot.
 *
 * Unauthenticated on purpose: this runs during onboarding, where the farmer may
 * not have a profile yet. It leaks nothing — the crop name and soil type come
 * from the request, and the response is generic agronomy.
 */
export async function POST(req: Request) {
  const apiKey = process.env.GROQ_API_KEY;

  let crop = "";
  let soil = "";
  let irrigation = "";
  let region = "";
  try {
    const body = await req.json();
    crop = String(body?.crop ?? "").slice(0, 60);
    soil = String(body?.soil ?? "").slice(0, 60);
    irrigation = String(body?.irrigation ?? "").slice(0, 60);
    region = String(body?.region ?? "").slice(0, 120);
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }
  if (!crop) return Response.json({ error: "No crop supplied." }, { status: 400 });

  // Facts, straight from the engine.
  const p = getCropProfile(crop);
  const known = Boolean(normalizeCrop(crop));
  const facts = {
    crop: p.displayName,
    cycleDays: p.cycleDays,
    yieldPerAcre: p.yieldPerAcre,
    waterHeavy: p.waterHeavy,
    heatThreshold: p.heatThreshold,
    stages: STAGE_LABELS,
  };

  if (!apiKey) {
    return Response.json({ facts, known, sections: null, note: "AI guidance unavailable." });
  }

  const system = `You are an Indian agronomist writing a short growing guide for a smallholder farmer.

These figures are authoritative — use them, never contradict or restate different ones:
- Crop: ${facts.crop}
- Seeding to harvest: ${facts.cycleDays} days
- Typical yield: ${facts.yieldPerAcre} quintals per acre
- Water demand: ${facts.waterHeavy ? "high (needs standing water or heavy irrigation)" : "moderate"}
- Heat stress begins near ${facts.heatThreshold}°C at flowering

This farmer's field: soil ${soil || "unspecified"}, irrigation ${irrigation || "unspecified"}, location ${region || "India"}.

Return ONLY JSON:
{
  "summary": "2 sentences on why this crop suits (or challenges) this field",
  "sowing": ["3 short bullets: land prep, spacing, seed rate/treatment"],
  "water": ["3 short bullets: irrigation timing and critical stages"],
  "nutrition": ["2-3 short bullets: fertiliser and soil health"],
  "pests": ["2-3 short bullets: likely pests/diseases and what to watch for"],
  "harvest": ["2-3 short bullets: maturity signs, harvesting, drying/storage"]
}

Each bullet under 18 words. Practical and specific. Use ₹ and metric units. No preamble.`;

  try {
    const res = await fetchWithRetry("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "llama-3.1-8b-instant",
        messages: [{ role: "system", content: system }],
        temperature: 0.4,
        max_tokens: 900,
        response_format: { type: "json_object" },
      }),
      signal: AbortSignal.timeout(25_000),
    }, { label: "groq/crop-guide" });

    if (!res.ok) {
      console.error("crop-guide groq error:", res.status);
      return Response.json({ facts, known, sections: null, note: "AI guidance unavailable." });
    }

    const data = await res.json();
    const raw = data?.choices?.[0]?.message?.content ?? "{}";
    let sections = null;
    try {
      sections = JSON.parse(raw);
    } catch {
      sections = null;
    }
    return Response.json({ facts, known, sections });
  } catch (e) {
    console.error("crop-guide failed:", e);
    // The facts alone still make a useful guide, so never fail the whole call.
    return Response.json({ facts, known, sections: null, note: "AI guidance unavailable." });
  }
}
