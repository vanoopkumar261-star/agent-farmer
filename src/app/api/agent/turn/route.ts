import { buildAssistantContext } from "@/lib/chatContext";
import { aiLanguageName } from "@/lib/i18n/config";
import { getSessionFarmer, getSessionUser } from "@/lib/auth";
import { checkQuota, consumeQuota, getPlan, planDenied } from "@/lib/entitlements";
import { fetchWithRetry, GROQ_TEXT_MODEL } from "@/lib/http";
import { checkRateLimit, rateLimited } from "@/lib/rateLimit";
import { PayloadTooLargeError, readJsonBounded } from "@/lib/apiInput";

export const dynamic = "force-dynamic";

type ChatMessage = { role: "user" | "assistant"; content: string };

/**
 * The tool-calling gateway for voice/agent actions — Phase 2 of the voice
 * architecture that /api/chat's plain Q&A never covered. This route does NOT
 * touch the database and never sees, needs, or can leak a farm's real UUID —
 * it only decides *which* tool to call with *which* farmer-facing arguments.
 * The mobile client is the only thing that ever executes a write: it calls
 * the same Supabase functions the manual UI uses (`addTxn`, etc.), scoped by
 * its own RLS session, and logs the result to `agent_actions` (027) itself.
 * A model hallucinating a tool call can therefore never write to data it
 * doesn't own or bypass RLS — the worst it can do is ask for a tool call
 * with bad arguments, which the client validates and refuses outright.
 *
 * Any future tool whose arguments must reference a specific farm should
 * follow the same rule the rest of this codebase already enforces (see
 * `resolveOwnedFarmIndex()` in agent-farmer-mobile/src/lib/agent/context.ts):
 * the model may only say "farm 2", by the spoken index shown in its context
 * below, never an id — the client is what resolves that to a UUID it owns.
 *
 * One tool in this first pass: `log_expense`. It's the single voice action
 * every piece of scaffolding already assumed (the bundled "Saved."/"Undone."
 * phrase pack, the undo log's `inverse` field, the example in half the
 * comments in agent-farmer-mobile/src/lib/agent/*.ts). Once this round trip
 * is proven end to end, more tools are additive: same pattern, new entry in
 * TOOLS below, new case in the mobile client's tool executor.
 */

const TOOLS = [
  {
    type: "function",
    function: {
      name: "log_expense",
      description:
        "Record a farm expense or income the farmer just described out loud, e.g. " +
        "'I spent two thousand rupees on fertilizer' or 'sold wheat for fifteen thousand'. " +
        "Only call this for a CLEAR statement of money spent or earned on the farm — never " +
        "for a vague mention of money, a question about past spending, or general advice.",
      parameters: {
        type: "object",
        properties: {
          kind: {
            type: "string",
            enum: ["expense", "income"],
            description: "'expense' for money spent, 'income' for money earned (e.g. a crop sale, a subsidy).",
          },
          category: {
            type: "string",
            enum: [
              "Seeds",
              "Fertilizer",
              "Pesticide",
              "Labor",
              "Machinery",
              "Irrigation",
              "Transport",
              "Crop Sale",
              "Subsidy",
              "Other",
            ],
            description: "Nearest matching category. Use 'Other' if nothing fits well.",
          },
          item_name: {
            type: "string",
            description: "A short label, e.g. 'Fertilizer' or 'Wheat sale'. Reuse the category name if nothing more specific was said.",
          },
          amount: {
            type: "number",
            description: "The amount in rupees as a plain number, e.g. 2000 (not '₹2,000' or 'two thousand').",
          },
        },
        required: ["kind", "category", "item_name", "amount"],
      },
    },
  },
] as const;

export async function POST(req: Request) {
  const rl = await checkRateLimit(req, "agent");
  if (!rl.ok) return rateLimited(rl);

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return Response.json({ reply: "The AI assistant is not configured (missing API key)." }, { status: 500 });
  }

  let messages: ChatMessage[] = [];
  let locale = "en";
  let screenSummary = "";
  try {
    const body = await readJsonBounded(req, 48_000);
    locale = typeof body?.locale === "string" ? body.locale : "en";
    screenSummary = typeof body?.screenSummary === "string" ? body.screenSummary.slice(0, 200) : "";
    messages = (body?.messages ?? [])
      .filter((m: any) => (m?.role === "user" || m?.role === "assistant") && typeof m?.content === "string")
      .map((m: any) => ({ role: m.role, content: String(m.content).slice(0, 4000) }));
  } catch (e) {
    if (e instanceof PayloadTooLargeError) return Response.json({ error: "Request body too large." }, { status: 413 });
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }
  messages = messages.slice(-6); // tool turns need less history than open chat

  const farmer = await getSessionFarmer();
  const user = await getSessionUser();
  if (!farmer) {
    return Response.json({ reply: "Please finish setting up your farm profile first." }, { status: 401 });
  }

  // Refused before the model is called, so a farmer who is out of queries is
  // not charged Groq tokens to be told so.
  if (user) {
    const guard = await checkQuota(user.id, "assistant_query", getPlan(farmer));
    if (!guard.ok) return planDenied(guard);
  }

  const context = await buildAssistantContext();
  const language = aiLanguageName(locale);

  const system = `You are the Agent Farmer voice assistant, operating hands-free for an Indian farmer who just spoke a command or question aloud.

You have live memory of this farmer's data:
${context}

${screenSummary ? `The farmer is currently looking at: ${screenSummary}\n\n` : ""}Guidelines:
- If the farmer clearly stated money spent or earned on the farm, call log_expense. Do not narrate the call in text — just call it.
- Otherwise, reply in ${language} exactly as the regular farming assistant would: concise (1-3 short sentences), practical, grounded only in the data above. Never invent farm data.
- Only farming topics. If asked about anything else, say briefly that you only help with farming.`;

  let groqRes: Response;
  try {
    groqRes = await fetchWithRetry(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: GROQ_TEXT_MODEL,
          messages: [{ role: "system", content: system }, ...messages],
          tools: TOOLS,
          tool_choice: "auto",
          temperature: 0.2,
          max_tokens: 600,
        }),
      },
      { label: "groq/agent-turn" }
    );
  } catch (e) {
    console.error("GROQ agent-turn unreachable:", e);
    return Response.json({ reply: "The connection to the AI engine dropped. Please try again." }, { status: 503 });
  }

  if (!groqRes.ok) {
    const errText = await groqRes.text().catch(() => "");
    console.error("GROQ agent-turn error:", groqRes.status, errText);
    const msg =
      groqRes.status === 429
        ? "The AI engine is rate-limited right now. Please wait a moment and try again."
        : "The AI engine is busy right now. Please try again in a moment.";
    return Response.json({ reply: msg }, { status: 502 });
  }

  const json = await groqRes.json();
  const message = json?.choices?.[0]?.message;
  const rawCall = message?.tool_calls?.[0];

  if (rawCall?.function?.name === "log_expense") {
    let args: Record<string, unknown> = {};
    try {
      args = JSON.parse(rawCall.function.arguments ?? "{}");
    } catch {
      return Response.json({ reply: "I heard an amount but couldn't quite parse it — please try again." });
    }
    return Response.json({ toolCall: { name: "log_expense", args } });
  }

  const reply = typeof message?.content === "string" && message.content.trim() ? message.content.trim() : "";
  // Same allowance as the chat assistant: this is the same question answered
  // through a different surface, so it draws on the same monthly budget.
  if (user) await consumeQuota(user.id, "assistant_query", getPlan(farmer));

  return Response.json({ reply: reply || "I didn't quite catch that." });
}
