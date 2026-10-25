import { buildAssistantContext } from "@/lib/chatContext";
import { aiLanguageName } from "@/lib/i18n/config";
import { getSessionFarmer, getSessionUser } from "@/lib/auth";
import { checkQuota, consumeQuota, getPlan, planDenied } from "@/lib/entitlements";
import { fetchWithRetry, GROQ_TEXT_MODEL, rateLimitMessage } from "@/lib/http";
import { checkRateLimit, rateLimited } from "@/lib/rateLimit";
import { VOICE_TOOLS, VOICE_TOOL_NAMES } from "@/lib/agent/voiceTools";
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
    // 200 was enough for a one-line caption and far too short for what the
    // screens actually send: the Today describer emits a weather line plus a
    // numbered task list, and mark_task_done's argument is an index into that
    // list. Truncated at 200 the list arrived cut off mid-item, so the model
    // could neither answer "which tasks are left" nor count to the right one.
    // 1200 holds a full screen's description and is still a fraction of the
    // farm context already in the prompt.
    screenSummary = typeof body?.screenSummary === "string" ? body.screenSummary.slice(0, 1200) : "";
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
- If they asked to see or open part of the app, call navigate. If they said they are finished, call sleep.
- Photographing a leaf is scan_leaf; taking a reading off a pH meter the farmer is holding is read_soil_meter. Both open the camera themselves, so never navigate to reach it. But asking to SEE the soil screen, or any other screen, is still navigate — the camera tools are for a farmer with the leaf or the meter in hand, not for anyone curious about soil.
- A price question that names a crop is check_price; a request to see prices generally is navigate to 'market'. A request to be spoken to in another language is set_language, not a navigation.
- Never answer a tool-shaped request with a clarifying question. If you are missing a detail, do the thing that shows the farmer everything — open the screen — rather than making them speak twice.
- Never call a tool and also describe it in words: the app speaks its own confirmation. One tool call per turn.
- Prefer answering from the data above over opening a screen. "How many farms do I have?" is a sentence, not a navigation.
- The check_* tools are for the things NOT in the data above: today's job list, the water balance, the health score, input prices, nearby shops, the scheme desk, active warnings. Use them instead of opening the screen — a farmer with their hands full asked to be told, not shown. If the data above already answers it, just answer.
- A crop the farmer SELLS is check_price; a thing the farmer BUYS — seed, fertiliser, pesticide — is check_input_price. "Urea" is an input, "cotton" is a crop.
- A pH number the farmer says out loud is set_soil_ph. Asking the app to read the meter is read_soil_meter. Never guess a pH they did not say.
- Otherwise, reply in ${language} exactly as the regular farming assistant would: concise (1-3 short sentences), practical, grounded only in the data above. Never invent farm data.
- A weather forecast, a sensor reading and a recommendation are three different things. Say which one you are giving, and never turn a single temperature or humidity number into an irrigation instruction on its own.
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
          tools: VOICE_TOOLS,
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
    // This route builds its own Groq call rather than going through
    // readGroqContent, so it needs the same honest 429 wording — it is the
    // one a farmer hears, and "wait a moment" is wrong by an order of
    // magnitude when the daily token budget is what ran out.
    const msg =
      groqRes.status === 429
        ? rateLimitMessage(errText)
        : "The AI engine is busy right now. Please try again in a moment.";
    return Response.json({ reply: msg }, { status: 502 });
  }

  const json = await groqRes.json();
  const message = json?.choices?.[0]?.message;
  const rawCall = message?.tool_calls?.[0];

  // Any tool this route declares is forwarded; the client has a handler for
  // each one and re-validates every argument before acting. A name the model
  // invented is not in VOICE_TOOL_NAMES and falls through to the text reply below,
  // which is the same outcome as the model simply having answered.
  const calledName = rawCall?.function?.name;
  if (typeof calledName === "string" && VOICE_TOOL_NAMES.has(calledName)) {
    let args: Record<string, unknown> = {};
    try {
      args = JSON.parse(rawCall.function.arguments ?? "{}");
    } catch {
      // Only the tools that carry arguments can fail here; the parameterless
      // ones (go_back, sleep, scan_leaf) are unaffected by a bad payload.
      if (calledName === "log_expense") {
        return Response.json({ reply: "I heard an amount but couldn't quite parse it — please try again." });
      }
      args = {};
    }
    return Response.json({ toolCall: { name: calledName, args } });
  }

  const reply = typeof message?.content === "string" && message.content.trim() ? message.content.trim() : "";
  // Same allowance as the chat assistant: this is the same question answered
  // through a different surface, so it draws on the same monthly budget.
  if (user) await consumeQuota(user.id, "assistant_query", getPlan(farmer));

  return Response.json({ reply: reply || "I didn't quite catch that." });
}
