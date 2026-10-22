import { getSessionFarmer } from "@/lib/auth";
import { aiLanguageName } from "@/lib/i18n/config";
import { fetchWithRetry, readGroqContent, GROQ_TEXT_MODEL } from "@/lib/http";
import { checkRateLimit, rateLimited } from "@/lib/rateLimit";
import { PayloadTooLargeError, payloadTooLarge, readJsonBounded } from "@/lib/apiInput";

export const dynamic = "force-dynamic";

/**
 * Turns a chat answer into what voice mode should say out loud.
 *
 * Voice asks the same assistant as typed chat, so the full answer — lists,
 * figures, bold headings — lands in the chat thread where it can be read. Read
 * aloud verbatim it is a minute and a half of Markdown, which the TTS voice
 * renders as something close to babble. This boils it down to a few spoken
 * sentences in the same language and points the farmer at the chat for the
 * rest. It adds nothing that the written answer does not already say.
 */
export async function POST(req: Request) {
  const rl = await checkRateLimit(req, "voice-summary");
  if (!rl.ok) return rateLimited(rl);

  const farmer = await getSessionFarmer();
  if (!farmer) return new Response("Not signed in.", { status: 401 });

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return new Response("The AI assistant is not configured.", { status: 500 });

  let text = "";
  let locale = "en";
  try {
    const body = await readJsonBounded(req, 16_000);
    text = typeof body?.text === "string" ? body.text.trim().slice(0, 6000) : "";
    if (typeof body?.locale === "string") locale = body.locale;
  } catch (e) {
    if (e instanceof PayloadTooLargeError) return payloadTooLarge();
    return new Response("Invalid request.", { status: 400 });
  }
  if (!text) return new Response("No text supplied.", { status: 400 });

  const language = aiLanguageName(locale);
  const system = `You turn a farming assistant's written answer into what a voice assistant says out loud, in ${language}.

- 2 or 3 short sentences, under 50 words in total. The single most important action comes first.
- Plain, everyday spoken ${language}, the way a farmer in a village talks. No textbook words.
- No lists, headings, bold, brackets, slashes, colons, abbreviations or symbols. Say "20 से 25", not "20-25"; say "नाइट्रोजन, फॉस्फोरस और पोटाश", not "N-P-K".
- If the answer points at a screen in the app, say its NAME only — "the crop health page". Never read a path out loud: "/dashboard/disease" spoken aloud is slash dashboard slash disease, which is unusable.
- Only say what the written answer says. Never add advice, numbers or facts of your own.
- Finish with one short sentence telling them the full answer is written in the chat.
- Reply with the spoken words only — nothing else.`;

  try {
    const res = await fetchWithRetry(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: GROQ_TEXT_MODEL,
          messages: [
            { role: "system", content: system },
            { role: "user", content: text },
          ],
          temperature: 0.2,
          // Left to its default, gpt-oss sometimes reasons past the budget and
          // returns empty content. A summary needs no deliberation.
          ...(GROQ_TEXT_MODEL.includes("gpt-oss") ? { reasoning_effort: "low" } : {}),
          // gpt-oss reasons before it answers, and the reasoning counts against this;
          // 400 was spent entirely on thinking and came back with empty content.
          max_tokens: 1200,
        }),
      },
      { label: "voice-summary" }
    );
    const summary = (await readGroqContent(res, "voice-summary")).trim();
    return new Response(summary, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
  } catch (e) {
    // The client falls back to the first sentences of the answer itself.
    console.error("voice-summary failed:", (e as Error)?.message ?? e);
    return new Response("Summary unavailable.", { status: 502 });
  }
}
