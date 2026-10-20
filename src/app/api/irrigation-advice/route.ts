import { getSessionFarmer } from "@/lib/auth";
import { planDenied, requirePlan } from "@/lib/entitlements";
import { fetchWithRetry, GROQ_TEXT_MODEL } from "@/lib/http";
import { checkRateLimit, rateLimited } from "@/lib/rateLimit";
import { readJsonBounded, clampStr, payloadTooLarge } from "@/lib/apiInput";

export const dynamic = "force-dynamic";

/**
 * Plain-language watering advice for one farm.
 *
 * ── The rule this route follows ──────────────────────────────────────────────
 * The model is never asked for a number. Depth, volume, run time, soil
 * capacity, the refill point and the forecast all come from
 * `computeIrrigationPlan()` and are handed over as settled facts; Groq's only
 * job is to turn them into two or three sentences a farmer can act on, in
 * their own language.
 *
 * That split is not stylistic. An LLM asked "how many millimetres does wheat
 * need" will answer confidently and plausibly whether or not it is right, and
 * a farmer who runs a pump on that answer has spent real water and real
 * electricity. `crop-guide` makes the same argument for the same reason.
 *
 * Fails soft everywhere: if the key is missing, Groq errors, or the response
 * is unparseable, the caller gets `advice: null` and keeps every number it
 * already had. The page is fully usable without this route ever succeeding.
 */

const LOCALE_NAME: Record<string, string> = {
  en: "English",
  hi: "Hindi",
  kn: "Kannada",
  ta: "Tamil",
  te: "Telugu",
  ml: "Malayalam",
  mr: "Marathi",
  bn: "Bengali",
  pa: "Punjabi",
};

export async function POST(req: Request) {
  const rl = await checkRateLimit(req, "irrigation-advice");
  if (!rl.ok) return rateLimited(rl);

  // Authenticated: unlike crop-guide this describes a specific registered
  // field, so it is a dashboard path, not an onboarding one.
  const farmer = await getSessionFarmer();
  if (!farmer) {
    return Response.json({ error: "Please sign in." }, { status: 401 });
  }

  // Smart Irrigation is a Krishi Pro feature. A straight tier gate rather than
  // an allowance: the FAO ETc calculation is ours and costs nothing per call,
  // so there is nothing to meter — it is either included or it is not.
  const guard = requirePlan(farmer, "pro", "irrigation");
  if (!guard.ok) return planDenied(guard);

  let body: any;
  try {
    body = await readJsonBounded(req, 8_000);
  } catch {
    return payloadTooLarge();
  }
  if (!body) return Response.json({ error: "Invalid request." }, { status: 400 });

  // Every figure below is produced by the engine and echoed back untouched.
  // Clamped only to bound the prompt, never to reinterpret.
  const f = {
    farmIndex: Number(body.farmIndex) || 0,
    crop: clampStr(body.crop, 40) || "the crop",
    stage: clampStr(body.stage, 30) || "",
    verdict: clampStr(body.verdict, 20),
    status: clampStr(body.status, 20),
    grossMm: Number(body.grossMm) || 0,
    volumeLitres: Number(body.volumeLitres) || 0,
    runMinutes: Number(body.runMinutes) || 0,
    availablePct: Number(body.availablePct) || 0,
    etcToday: Number(body.etcToday) || 0,
    rainMm: Number(body.rainMm) || 0,
    regime: clampStr(body.regime, 20),
    method: clampStr(body.method, 30),
    soil: clampStr(body.soil, 40),
    savedLitres: Number(body.savedLitres) || 0,
    assumedStart: body.assumedStart === true,
  };
  const locale = clampStr(body.locale, 5) || "en";
  const language = LOCALE_NAME[locale] ?? "English";

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return Response.json({ advice: null, note: "AI guidance unavailable." });

  const system = `You are an Indian irrigation advisor speaking to a smallholder farmer.

These figures were computed by a FAO-56 soil water balance. They are authoritative. Use them, never invent or alter a number, and never state a figure that is not listed here:
- Farm ${f.farmIndex}, growing ${f.crop}${f.stage ? ` at the ${f.stage} stage` : ""}
- Soil: ${f.soil || "unspecified"}
- Water setup: ${f.regime === "rainfed" ? "RAIN-FED — this farmer has no irrigation at all" : `irrigated, applied by ${f.method || "an unrecorded method"}`}
- Soil water right now: ${f.availablePct}% of what the root zone can hold
- The crop is using ${f.etcToday} mm per day
- Rain forecast over the next 3 days: ${f.rainMm} mm
- Today's recommendation: ${f.verdict === "irrigate_today" ? `irrigate — apply ${f.grossMm} mm, about ${Math.round(f.volumeLitres)} litres, roughly ${f.runMinutes} minutes of running` : f.verdict === "rain_coming" ? "hold off, rain is coming" : f.verdict === "no_crop" ? "no crop is sown" : "no watering needed today"}
- Field status: ${f.status}
${f.savedLitres > 0 ? `- Following this plan instead of a fixed weekly schedule saves about ${Math.round(f.savedLitres)} litres this week` : ""}
${f.assumedStart ? "- NOTE: starting soil moisture was estimated, not measured. If you mention confidence, say the estimate improves once they log a watering." : ""}

Write in ${language}. Reply with ONLY this JSON:
{
  "headline": "one short sentence — the action, under 12 words",
  "why": "two sentences explaining the reasoning in plain words a farmer uses",
  "tips": ["two short practical bullets, under 16 words each"]
}

${f.regime === "rainfed" ? "This farmer CANNOT irrigate. Never tell them to water, run a pump, or install anything today. Advise on conserving the moisture they have." : ""}
Speak directly and warmly. No preamble, no markdown, no disclaimers.`;

  try {
    const res = await fetchWithRetry(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: GROQ_TEXT_MODEL,
          messages: [{ role: "system", content: system }],
          temperature: 0.3,
          // Reasoning tokens are billed against this before any visible output
          // — the same trap documented in crop-guide. This response is far
          // shorter than a growing guide, but the reasoning is not.
          max_tokens: 1800,
          response_format: { type: "json_object" },
        }),
        signal: AbortSignal.timeout(20_000),
      },
      { label: "groq/irrigation-advice" }
    );

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      console.error("irrigation-advice groq error:", res.status, detail.slice(0, 400));
      return Response.json({ advice: null, note: "AI guidance unavailable." });
    }

    const data = await res.json();
    const raw = data?.choices?.[0]?.message?.content ?? "{}";
    try {
      const parsed = JSON.parse(raw);
      return Response.json({
        advice: {
          headline: String(parsed.headline ?? "").slice(0, 200),
          why: String(parsed.why ?? "").slice(0, 600),
          tips: Array.isArray(parsed.tips)
            ? parsed.tips.slice(0, 3).map((x: any) => String(x).slice(0, 200))
            : [],
        },
      });
    } catch {
      return Response.json({ advice: null, note: "AI guidance unavailable." });
    }
  } catch (e) {
    console.error("irrigation-advice failed:", e);
    // The plan's own numbers are already on screen; losing the prose costs
    // nothing a farmer needs.
    return Response.json({ advice: null, note: "AI guidance unavailable." });
  }
}
