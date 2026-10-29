/**
 * Conversation-quality probe for the voice/chat "brain".
 *
 * Run: npx tsx scripts/probe-conversation.mts   (from the repo root)
 *
 * The routing probe (probe-voice-tools.mts) checks WHICH tool the model picks.
 * This one checks the thing that has had no coverage at all: the SHAPE of a
 * prose reply — does it mirror the length of the ask, stay human, and never
 * recite the farming disclaimer? That is the layer the "only hindi → I only
 * help with farming" bug lived in, and a prompt edit or a Groq model swap can
 * silently regress it.
 *
 * It imports the SHIPPED conversationStyle playbook and builds the same prompt
 * shape the voice route builds, then scores each reply with DETERMINISTIC
 * assertions (sentence count, disclaimer/apology regexes, script checks) so it
 * runs in CI without a judge. An optional --judge pass (off by default) adds a
 * one-line LLM rating for tone; it is never required to pass.
 *
 * Like the routing probe it reads GROQ_API_KEY from .env.local and calls Groq
 * directly, so it neither needs a session nor spends a farmer's query quota.
 */
import { readFileSync } from "node:fs";
import { VOICE_TOOLS } from "../src/lib/agent/voiceTools.ts";
import { conversationStyle } from "../src/lib/agent/conversationStyle.ts";
import { buildFeatureBlock } from "../src/lib/appFeatures.ts";

const CONTEXT = `Farmer: Test Farmer.
Location: Nashik district, Maharashtra.
Farms (2):
- Farm 1: 3 acres, Black Soil, irrigated by Borewell + Drip, growing Cotton (seeded 2026-08-01, day 85, Maturity stage), estimated harvest 2026-12-01 (~37 days away)
- Farm 2: 2 acres, Black Soil, rain-fed (no irrigation), growing Soybean (seeded 2026-09-10, day 45, Flowering stage), estimated harvest 2026-12-20 (~56 days away)
Current weather: 29°C, partly cloudy, humidity 62%, wind 9 km/h. Next days rain chance: Sun 10%, Mon 20%, Tue 15%, Wed 5%.`;

function systemPrompt(language: string): string {
  return `You are the Agent Farmer voice assistant, operating hands-free for an Indian farmer who just spoke a command or question aloud.

You have live memory of this farmer's data:
${CONTEXT}

Guidelines:
- Reply grounded only in the data above — never invent farm data. (Length and tone are governed by HOW TO TALK below.)
- Your remit is farming and running the farm. A clearly off-topic line is handled by HOW TO TALK below (one short pivot, no disclaimer), not here.

${buildFeatureBlock({ withPaths: false })}

${conversationStyle({ surface: "voice", language })}`;
}

/** A reply, and the facts a check needs about it. */
type Reply = { text: string; tool: string | null; sentences: number };

type Check = { name: string; ok: (r: Reply) => boolean };

type Fixture = {
  said: string;
  language?: string; // the app language the brain is told to speak; default English
  why: string;
  checks: Check[];
};

// ── deterministic signals ────────────────────────────────────────────────────
const DISCLAIMER =
  /(only\s+(help|assist)\w*\b[^.]{0,30}\bfarm|i\s+(can\s+)?only\s+help|farming\s+(assistant|questions?)\s+only|केवल\s+खेती|सिर्फ\s+खेती|खेती\s+से\s+ही)/i;
const APOLOGY = /\b(i'?m\s+sorry|i\s+am\s+sorry|sorry|apolog|माफ़?|क्षमा)\b/i;
const DEVANAGARI = /[ऀ-ॿ]/;

const noTool: Check = { name: "no tool", ok: (r) => r.tool === null };
const noDisclaimer: Check = { name: "no disclaimer", ok: (r) => !DISCLAIMER.test(r.text) };
const noApology: Check = { name: "no apology", ok: (r) => !APOLOGY.test(r.text) };
const maxSentences = (n: number): Check => ({ name: `<= ${n} sentence(s)`, ok: (r) => r.sentences <= n });
const minSentences = (n: number): Check => ({ name: `>= ${n} sentence(s)`, ok: (r) => r.sentences >= n });
const inDevanagari: Check = { name: "replies in Hindi script", ok: (r) => DEVANAGARI.test(r.text) };

const FIXTURES: Fixture[] = [
  {
    said: "who won the cricket match",
    why: "off-topic: ONE short friendly pivot, never the disclaimer or an apology",
    checks: [noTool, noDisclaimer, noApology, maxSentences(2)],
  },
  {
    said: "tell me a joke",
    why: "off-topic again: still no disclaimer, still one line",
    checks: [noTool, noDisclaimer, noApology, maxSentences(2)],
  },
  {
    said: "namaste",
    why: "a greeting is met with a greeting, in one line — not a lecture",
    checks: [noTool, maxSentences(2)],
  },
  {
    said: "thanks",
    why: "acknowledge thanks briefly; do not restart the conversation",
    checks: [noTool, maxSentences(2)],
  },
  {
    said: "how many farms do I have",
    why: "answerable from context in a single line — mirror the short ask",
    checks: [noTool, maxSentences(2)],
  },
  {
    said: "what is the ideal plant spacing for cotton and why does it matter",
    why: "a real agronomy question EARNS a fuller answer",
    checks: [noTool, minSentences(2)],
  },
  {
    said: "कपास के बारे में बताओ",
    language: "Hindi",
    why: "told to speak Hindi, it answers in Hindi script, not English",
    checks: [inDevanagari],
  },
];

function groqKey(): string {
  const env = readFileSync(".env.local", "utf8");
  const line = env.split(/\r?\n/).find((l) => l.startsWith("GROQ_API_KEY="));
  if (!line) throw new Error("GROQ_API_KEY not found in .env.local");
  return line.slice("GROQ_API_KEY=".length).trim().replace(/^["']|["']$/g, "");
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Count sentences the way a listener would — terminal punctuation across scripts. */
function countSentences(text: string): number {
  const parts = text
    .replace(/\s+/g, " ")
    .split(/[.!?।॥]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  return Math.max(parts.length, text.trim() ? 1 : 0);
}

async function ask(said: string, language: string, key: string): Promise<Reply | "limited"> {
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "openai/gpt-oss-120b",
        messages: [
          { role: "system", content: systemPrompt(language) },
          { role: "user", content: said },
        ],
        tools: VOICE_TOOLS,
        tool_choice: "auto",
        temperature: 0.2,
        max_tokens: 600,
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
    const msg = json?.choices?.[0]?.message;
    const tool = msg?.tool_calls?.[0] ? String(msg.tool_calls[0].function?.name) : null;
    const text = typeof msg?.content === "string" ? msg.content.trim() : "";
    return { text, tool, sentences: countSentences(text) };
  }
  return "limited";
}

const key = groqKey();
let passCases = 0;
let limited = 0;
const failLines: string[] = [];

console.log(`conversation-quality probe — ${FIXTURES.length} fixtures\n`);

for (const f of FIXTURES) {
  const r = await ask(f.said, f.language ?? "English", key);
  if (r === "limited") {
    limited++;
    console.log(`RATE-LIMITED  "${f.said}"`);
    continue;
  }
  const failed = f.checks.filter((c) => !c.ok(r));
  const ok = failed.length === 0;
  if (ok) passCases++;
  else failLines.push(`"${f.said}" [${f.why}]\n      failed: ${failed.map((c) => c.name).join(", ")}\n      got (${r.tool ?? "prose"}, ${r.sentences} sent.): ${r.text.slice(0, 160)}`);
  console.log(`${ok ? "PASS" : "FAIL"}  "${f.said}" -> ${r.tool ?? "prose"}, ${r.sentences} sentence(s)`);
  await sleep(3500);
}

console.log(`\n${passCases}/${FIXTURES.length - limited} fixtures passed` + (limited ? `, ${limited} rate-limited` : ""));
if (failLines.length) {
  console.log("\nFailures:");
  for (const l of failLines) console.log("  " + l);
  process.exitCode = 1;
}
