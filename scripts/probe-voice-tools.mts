/**
 * Routing probe for the voice assistant's tool table.
 *
 * Run: npx tsx scripts/probe-voice-tools.mts   (from the repo root)
 *
 * It imports the SHIPPED array from src/lib/agent/voiceTools.ts and calls Groq
 * directly with the same system prompt shape the route builds. Two reasons it
 * does not go through /api/agent/turn: the route consumes the farmer's
 * assistant_query quota (20 a month on free), and it needs a signed-in
 * session. What is being measured here is the model's choice, which is the
 * part that breaks when a new tool steals an old one's phrasing.
 *
 * It reports, per case, the tool picked vs the tool expected, and counts 429s
 * separately — a rate-limited case is not a routing failure and must not be
 * scored as one.
 */
import { readFileSync } from "node:fs";
import { VOICE_TOOLS } from "../src/lib/agent/voiceTools.ts";

type Case = { said: string; expect: string | null; why?: string };

/** `null` = must answer in prose, no tool. */
const CASES: Case[] = [
  // ── the nine that already shipped: regression cover ──────────────────────
  { said: "log two thousand rupees for urea", expect: "log_expense" },
  { said: "open the market", expect: "navigate" },
  { said: "go back", expect: "go_back" },
  { said: "that's all, thanks", expect: "sleep" },
  { said: "scan this leaf", expect: "scan_leaf" },
  { said: "मैंने पत्ते की फोटो लेनी है", expect: "scan_leaf" },
  { said: "mark the first task done", expect: "mark_task_done" },
  { said: "read my pH meter", expect: "read_soil_meter" },
  { said: "what is cotton going for", expect: "check_price" },
  { said: "कपास का भाव क्या है", expect: "check_price" },
  { said: "मंडी के भाव देखने हैं", expect: "navigate", why: "general prices = the screen" },
  { said: "speak to me in Tamil", expect: "set_language" },

  // ── the soil fix: seeing the screen is NOT the camera ────────────────────
  { said: "show me the soil", expect: "navigate" },
  { said: "मिट्टी की जाँच करो", expect: "navigate", why: "was stolen by read_soil_meter" },
  { said: "take me to input prices", expect: "navigate" },
  { said: "open irrigation", expect: "navigate" },

  // ── the new beta set ────────────────────────────────────────────────────
  { said: "what should I do today", expect: "check_tasks" },
  { said: "आज क्या काम है", expect: "check_tasks" },
  { said: "is anything left on the list", expect: "check_tasks" },
  { said: "should I water farm two today", expect: "check_irrigation" },
  { said: "कितना पानी देना है", expect: "check_irrigation" },
  { said: "how is my farm doing", expect: "check_health" },
  { said: "खेत की सेहत कैसी है", expect: "check_health" },
  { said: "what does a bag of urea cost", expect: "check_input_price" },
  { said: "यूरिया का दाम क्या है", expect: "check_input_price" },
  { said: "where can I buy urea", expect: "find_store" },
  { said: "खाद की दुकान कहाँ है", expect: "find_store" },
  { said: "what subsidy can I get", expect: "check_scheme" },
  { said: "सरकारी योजना क्या मिलेगी", expect: "check_scheme" },
  { said: "any warnings for my farm", expect: "check_alerts" },
  { said: "my meter says six point four", expect: "set_soil_ph" },
  { said: "पी-एच छह दशमलव चार है", expect: "set_soil_ph" },
  { said: "add a new field", expect: "add_farm" },
  { said: "नया खेत जोड़ना है", expect: "add_farm" },
  { said: "turn on night mode", expect: "set_theme" },
  { said: "रात का मोड चालू करो", expect: "set_theme" },
  { said: "show me how to use this app", expect: "replay_tutorial" },

  // ── must NOT fire a tool: the context already answers these ─────────────
  { said: "what's the weather today", expect: null, why: "weather is in context" },
  { said: "how much have I spent so far", expect: null, why: "ledger is in context" },
  { said: "when do I harvest", expect: null, why: "harvest date is in context" },
  { said: "how many farms do I have", expect: null, why: "farms are in context" },
  { said: "who won the cricket match", expect: null, why: "off-topic, declines" },
];

/** A stand-in for buildAssistantContext(), with the same shape and fields. */
const CONTEXT = `Farmer: Test Farmer.
Location: Nashik district, Maharashtra.
Farms (2):
- Farm 1: 3 acres, Black Soil, irrigated by Borewell + Drip, growing Cotton (seeded 2026-08-01, day 85, Maturity stage), estimated harvest 2026-12-01 (~37 days away)
- Farm 2: 2 acres, Black Soil, rain-fed (no irrigation), growing Soybean (seeded 2026-09-10, day 45, Flowering stage), estimated harvest 2026-12-20 (~56 days away)
Current weather: 29°C, partly cloudy, humidity 62%, wind 9 km/h. Next days rain chance: Sun 10%, Mon 20%, Tue 15%, Wed 5%.
Latest soil pH: 6.8 (measured 24/10/2026) — slightly acidic. Suitable for most crops.
Recent disease scans:
- 24/10/2026: Cotton — healthy (91%)
Ledger (all time): spent ₹48,000, earned ₹1,20,000, profit ₹72,000. Biggest expense categories: Fertilizer ₹18,000, Seed ₹12,000, Labour ₹10,000.`;

function systemPrompt(): string {
  // The guideline block, copied from the route. Kept here rather than imported
  // because it is built inline from `language`/`context` in the handler.
  return `You are the Agent Farmer voice assistant, operating hands-free for an Indian farmer who just spoke a command or question aloud.

You have live memory of this farmer's data:
${CONTEXT}

Guidelines:
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
- Otherwise, reply in English exactly as the regular farming assistant would: concise (1-3 short sentences), practical, grounded only in the data above. Never invent farm data.
- A weather forecast, a sensor reading and a recommendation are three different things. Say which one you are giving, and never turn a single temperature or humidity number into an irrigation instruction on its own.
- Only farming topics. If asked about anything else, say briefly that you only help with farming.`;
}

function groqKey(): string {
  const env = readFileSync(".env.local", "utf8");
  const line = env.split(/\r?\n/).find((l) => l.startsWith("GROQ_API_KEY="));
  if (!line) throw new Error("GROQ_API_KEY not found in .env.local");
  return line.slice("GROQ_API_KEY=".length).trim().replace(/^["']|["']$/g, "");
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function ask(said: string, key: string): Promise<{ tool: string | null; rateLimited: boolean }> {
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "openai/gpt-oss-120b",
        messages: [
          { role: "system", content: systemPrompt() },
          { role: "user", content: said },
        ],
        tools: VOICE_TOOLS,
        tool_choice: "auto",
        temperature: 0,
      }),
    });
    if (res.status === 429) {
      const wait = Number(res.headers.get("retry-after") ?? "6");
      process.stdout.write(`  (429, waiting ${wait}s) `);
      await sleep((Number.isFinite(wait) ? wait : 6) * 1000 + 500);
      continue;
    }
    if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
    const json: any = await res.json();
    const call = json?.choices?.[0]?.message?.tool_calls?.[0];
    return { tool: call ? String(call.function?.name) : null, rateLimited: false };
  }
  return { tool: null, rateLimited: true };
}

const key = groqKey();
let pass = 0;
const fails: string[] = [];
let limited = 0;

console.log(`${VOICE_TOOLS.length} tools, ${CASES.length} cases\n`);

for (const c of CASES) {
  const { tool, rateLimited } = await ask(c.said, key);
  if (rateLimited) {
    limited++;
    console.log(`RATE-LIMITED  "${c.said}"`);
    continue;
  }
  const want = c.expect;
  const ok = tool === want;
  if (ok) pass++;
  else fails.push(`"${c.said}" -> ${tool ?? "(prose)"} , expected ${want ?? "(prose)"}${c.why ? ` [${c.why}]` : ""}`);
  console.log(`${ok ? "PASS" : "FAIL"}  "${c.said}" -> ${tool ?? "(prose)"}${ok ? "" : `  expected ${want ?? "(prose)"}`}`);
  // Pacing: the whole point is to find routing errors, not to fight the TPM
  // ceiling. 20 tools is roughly 1,800 tokens of schema per call.
  await sleep(3500);
}

console.log(`\n${pass}/${CASES.length - limited} routed correctly` + (limited ? `, ${limited} rate-limited` : ""));
if (fails.length) {
  console.log("\nFailures:");
  for (const f of fails) console.log("  " + f);
}
