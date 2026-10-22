import { NextResponse } from "next/server";
import { getSessionFarmer } from "@/lib/auth";
import { checkRateLimit, rateLimited } from "@/lib/rateLimit";
import { fetchWithRetry, readGroqContent, GROQ_TEXT_MODEL } from "@/lib/http";
import {
  assessCropFeasibility,
  suitableAlternatives,
  type FeasibilityResult,
  type FieldConditions,
} from "@/lib/cropFeasibility";

export const dynamic = "force-dynamic";

/**
 * Judges a freehand crop name against one field's conditions.
 *
 * Two tiers, and the order matters:
 *
 *   1. `assessCropFeasibility` — the table in src/lib/cropFeasibility.ts. For
 *      the 25 crops the engine knows this is instant, free and deterministic,
 *      and it is what the client has already run locally before calling here.
 *   2. Groq, only when the table returns `unknown` — a name it has no row for.
 *      That is the case the table cannot help with: "Apple", "Saffron",
 *      "asdfgh" and "Dragon fruit" are all equally unknown to it, and they are
 *      four very different answers.
 *
 * The model is asked a narrow question with a fixed JSON shape, not for advice.
 * It decides whether the name is a real crop at all and whether it can be grown
 * on the stated soil, pH and climate in India. Anything it is unsure about
 * comes back as `caution`, never `unsuitable` — refusing a farmer's input on a
 * model's hunch is worse than letting an unusual crop through.
 */

/** A name longer than this is not a crop; it is a paste or an attack. */
const MAX_NAME = 60;

type Body = {
  crop?: unknown;
  conditions?: {
    soilType?: unknown;
    soilPh?: unknown;
    irrigation?: unknown;
    typicalHighC?: unknown;
    typicalLowC?: unknown;
  };
};

function str(v: unknown, max = 60): string | null {
  return typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null;
}
function num(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

/**
 * Asks Groq about a crop the table has never heard of.
 *
 * Returns null on any failure — no key, a timeout, unparseable JSON. The caller
 * then lets the input through as `unknown`, which is the safe direction: the
 * farmer keeps control of their own field when the check cannot run.
 */
async function askModel(
  crop: string,
  conditions: FieldConditions
): Promise<{ verdict: "ok" | "caution" | "unsuitable"; reason: string; isCrop: boolean } | null> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return null;

  const field = [
    conditions.soilType ? `soil type: ${conditions.soilType}` : null,
    conditions.soilPh != null ? `soil pH: ${conditions.soilPh}` : null,
    conditions.irrigation ? `irrigation: ${conditions.irrigation}` : null,
    conditions.typicalHighC != null ? `typical daytime high: ${conditions.typicalHighC}°C` : null,
    conditions.typicalLowC != null ? `typical overnight low: ${conditions.typicalLowC}°C` : null,
  ]
    .filter(Boolean)
    .join(", ");

  try {
    const res = await fetchWithRetry(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: GROQ_TEXT_MODEL,
          temperature: 0,
          // 800, not 300. gpt-oss spends this budget on a reasoning pass before
          // it writes anything, and at 300 the JSON came back truncated
          // mid-sentence on longer answers ("Dragon fruit") — which parses as
          // nothing and silently let the crop through. `reasoning_effort: low`
          // keeps that pass short; the two together parse reliably.
          max_tokens: 800,
          ...(GROQ_TEXT_MODEL.includes("gpt-oss") ? { reasoning_effort: "low" } : {}),
          messages: [
            {
              role: "system",
              content:
                "You advise Indian farmers. Decide whether a named crop can be grown on a described field. " +
                'Return ONLY JSON: {"isCrop": boolean, "verdict": "ok"|"caution"|"unsuitable", "reason": "one short sentence"}. ' +
                'Set isCrop false if the name is not a real agricultural crop (gibberish, an animal, an object). ' +
                'Use "unsuitable" ONLY when the crop clearly cannot grow in these conditions in India. ' +
                'If you are unsure, use "caution". Never use "unsuitable" merely because a crop is unusual.',
            },
            {
              role: "user",
              content: `Crop: "${crop}"\nField: ${field || "no details supplied"}`,
            },
          ],
        }),
        signal: AbortSignal.timeout(12_000),
      },
      { label: "groq/crop-feasibility", retries: 1 }
    );

    const raw = await readGroqContent(res, "groq/crop-feasibility");
    const cleaned = raw.replace(/```json/gi, "").replace(/```/g, "").trim();
    const a = cleaned.indexOf("{");
    const b = cleaned.lastIndexOf("}");
    if (a === -1 || b === -1) return null;
    const parsed = JSON.parse(cleaned.slice(a, b + 1));

    const verdict =
      parsed?.verdict === "ok" || parsed?.verdict === "unsuitable" ? parsed.verdict : "caution";
    return {
      verdict,
      reason: typeof parsed?.reason === "string" ? parsed.reason.slice(0, 200) : "",
      isCrop: parsed?.isCrop !== false,
    };
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  const rl = await checkRateLimit(req, "cropFeasibility");
  if (!rl.ok) return rateLimited(rl);

  // Signed in only: this spends Groq tokens on the unknown-name path.
  const farmer = await getSessionFarmer();
  if (!farmer) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const crop = str(body.crop, MAX_NAME);
  if (!crop) return NextResponse.json({ error: "No crop supplied." }, { status: 400 });

  const conditions: FieldConditions = {
    soilType: str(body.conditions?.soilType, 40),
    soilPh: num(body.conditions?.soilPh),
    irrigation: str(body.conditions?.irrigation, 40),
    typicalHighC: num(body.conditions?.typicalHighC),
    typicalLowC: num(body.conditions?.typicalLowC),
  };

  const local = assessCropFeasibility(crop, conditions);
  if (local.verdict !== "unknown") {
    return NextResponse.json({ ...local, source: "table" });
  }

  const model = await askModel(crop, conditions);
  if (!model) {
    // Check unavailable. Let it through rather than block on a failure.
    return NextResponse.json({ ...local, source: "unavailable" } satisfies FeasibilityResult & {
      source: string;
    });
  }

  if (!model.isCrop) {
    return NextResponse.json({
      verdict: "unsuitable",
      crop,
      source: "model",
      reasons: [
        {
          condition: "soil",
          severity: "blocking",
          label: `"${crop}" is not a crop we can plan for`,
          msgKey: "feasibility.notACrop",
          params: { crop },
        },
      ],
      alternatives: suitableAlternatives(conditions),
    });
  }

  return NextResponse.json({
    verdict: model.verdict,
    crop,
    source: "model",
    reasons: model.reason
      ? [
          {
            condition: "soil",
            severity: model.verdict === "unsuitable" ? "blocking" : "warning",
            label: model.reason,
            // The model writes this sentence, so there is no dictionary key for
            // it. The UI renders `label` when msgKey is empty.
            msgKey: "",
          },
        ]
      : [],
    alternatives: model.verdict === "unsuitable" ? suitableAlternatives(conditions) : [],
  });
}
