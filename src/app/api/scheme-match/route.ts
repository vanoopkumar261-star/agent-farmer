import { NextResponse } from "next/server";
import { aiLanguageName } from "@/lib/i18n/config";
import { fetchWithRetry, readGroqContent, GROQ_TEXT_MODEL } from "@/lib/http";
import { checkRateLimit, rateLimited } from "@/lib/rateLimit";
import { clampArr, clampStr, payloadTooLarge, PayloadTooLargeError, readJsonBounded } from "@/lib/apiInput";

export const dynamic = "force-dynamic";
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

/**
 * Returns null rather than throwing when the model gives back something that
 * is not JSON. An unparseable reply is an ordinary outcome of a model call, not
 * a server fault, and letting it escape as a 500 broke the whole Schemes screen
 * — on mobile, where this route is the only source, the farmer got nothing.
 * /api/news already degrades this way (see its catch returning []).
 */
function safeParse(raw: string): any | null {
  const c = raw.replace(/```json/gi, "").replace(/```/g, "").trim();
  const a = c.indexOf("{");
  const b = c.lastIndexOf("}");
  if (a === -1 || b === -1) return null;
  try {
    return JSON.parse(c.slice(a, b + 1));
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  // Counted before any work is done — the point is to refuse the expensive
  // call, not to do it and then complain.
  const rl = await checkRateLimit(req, "scheme-match");
  if (!rl.ok) return rateLimited(rl);

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "AI not configured" }, { status: 500 });

  try {
    let input: any;
    try {
      input = await readJsonBounded(req, 16_000);
    } catch (e) {
      if (e instanceof PayloadTooLargeError) return payloadTooLarge();
      return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    }

    const language = aiLanguageName(typeof input?.locale === "string" ? input.locale : "en");
    const profile = clampStr(input?.profile, 2000);
    const schemes = clampArr<any>(input?.schemes, 40).map((s) => ({
      id: clampStr(s?.id, 60),
      name: clampStr(s?.name, 120),
      short: clampStr(s?.short, 300),
    }));

    const shape = `{
  "headline": "one short sentence",
  "matches": [ { "id": "scheme id", "why": "short reason (<15 words)" } ]
}`;

    const prompt = `You match Indian government agriculture schemes to a farmer. Write "headline" and each "why" in ${language}; keep the scheme "id" values exactly as given.
Farmer: ${profile}.
Available schemes (id — name — who it's for):
${(schemes ?? []).map((s: any) => `- ${s.id} — ${s.name} — ${s.short}`).join("\n")}

Pick the 3 most relevant scheme ids for THIS farmer and give a short reason each. Return ONLY JSON: ${shape}. Use only ids from the list. JSON only.`;

    const res = await fetchWithRetry(GROQ_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: GROQ_TEXT_MODEL,
        messages: [
          { role: "system", content: "Return valid JSON only." },
          { role: "user", content: prompt },
        ],
        temperature: 0.3,
      }),
    }, { label: "groq/scheme-match" });
    const raw = await readGroqContent(res, "groq/scheme-match");
    const parsed = safeParse(raw);
    if (!parsed) {
      console.warn("SCHEME match: model returned no JSON; serving an empty match set.");
      return NextResponse.json({ headline: "", matches: [] });
    }
    return NextResponse.json(parsed);
  } catch (e: any) {
    console.error("SCHEME match error:", e);
    return NextResponse.json({ error: e?.message ?? "failed" }, { status: 500 });
  }
}
