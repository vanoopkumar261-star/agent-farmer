import { NextResponse } from "next/server";
import { aiLanguageName } from "@/lib/i18n/config";
import { fetchWithRetry } from "@/lib/http";

export const dynamic = "force-dynamic";
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

function safeParse(raw: string): any {
  const c = raw.replace(/```json/gi, "").replace(/```/g, "").trim();
  const a = c.indexOf("{");
  const b = c.lastIndexOf("}");
  if (a === -1 || b === -1) throw new Error("No JSON");
  return JSON.parse(c.slice(a, b + 1));
}

export async function POST(req: Request) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "AI not configured" }, { status: 500 });

  try {
    const { profile, schemes, locale } = await req.json();
    const language = aiLanguageName(locale ?? "en");

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
        model: "llama-3.1-8b-instant",
        messages: [
          { role: "system", content: "Return valid JSON only." },
          { role: "user", content: prompt },
        ],
        temperature: 0.3,
      }),
    }, { label: "groq/scheme-match" });
    const data = await res.json();
    const raw = data?.choices?.[0]?.message?.content;
    if (!raw) throw new Error("empty");
    return NextResponse.json(safeParse(raw));
  } catch (e: any) {
    console.error("SCHEME match error:", e);
    return NextResponse.json({ error: e?.message ?? "failed" }, { status: 500 });
  }
}
