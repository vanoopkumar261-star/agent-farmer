/**
 * A raw Groq chat client for the model suite.
 *
 * It exists because `readGroqContent()` in src/lib/http.ts CANNOT be used for
 * tool calling. That helper does:
 *
 *     const raw = data?.choices?.[0]?.message?.content;
 *     if (!raw) throw new Error("The AI engine returned no content.");
 *
 * and a tool call is *exactly* `content: null` with `tool_calls` populated. So
 * every existing Groq call site in the app would throw on the first tool call
 * it ever received. That is a finding, not a footnote — probe M0 records it —
 * and the fix in the build is a sibling `readGroqMessage()` that returns the
 * whole message object.
 *
 * This client returns the whole message and never throws on empty content.
 */
import { fetchRetry, readBody } from "./fetchx.mjs";

const URL_CHAT = "https://api.groq.com/openai/v1/chat/completions";
const URL_MODELS = "https://api.groq.com/openai/v1/models";

/** Matches src/lib/http.ts's default so the harness tests what the app runs. */
export const TEXT_MODEL = process.env.GROQ_TEXT_MODEL || "openai/gpt-oss-120b";

/**
 * Rolling 60-second token accounting.
 *
 * Groq's free tier is 30 requests AND 6,000 tokens per minute, and the token
 * ceiling is by far the tighter one: a single RAG-bearing chat turn carries
 * ~2k prompt tokens. Without this the model suite would produce a cascade of
 * 429s that read like model failures. The margin is deliberate — we block at
 * 5,000 so a call whose size we cannot predict still has room to land.
 */
export class TokenGovernor {
  constructor(ceiling = 5000, windowMs = 60_000) {
    this.ceiling = ceiling;
    this.windowMs = windowMs;
    this.events = [];
    this.calls = 0;
    this.promptTokens = 0;
    this.completionTokens = 0;
  }

  #prune() {
    const cutoff = Date.now() - this.windowMs;
    this.events = this.events.filter((e) => e.at > cutoff);
  }

  used() {
    this.#prune();
    return this.events.reduce((n, e) => n + e.tokens, 0);
  }

  /** Waits until `estimate` more tokens would fit inside the window. */
  async reserve(estimate = 800) {
    for (;;) {
      const used = this.used();
      if (used + estimate <= this.ceiling) return;
      const oldest = this.events[0];
      const waitMs = oldest ? Math.max(1000, oldest.at + this.windowMs - Date.now()) : 1000;
      process.stderr.write(
        `    … token governor: ${used}/${this.ceiling} in window, waiting ${Math.ceil(waitMs / 1000)}s\n`
      );
      await new Promise((r) => setTimeout(r, waitMs));
    }
  }

  record(usage) {
    const tokens = usage?.total_tokens ?? 0;
    this.events.push({ at: Date.now(), tokens });
    this.calls++;
    this.promptTokens += usage?.prompt_tokens ?? 0;
    this.completionTokens += usage?.completion_tokens ?? 0;
  }

  summary() {
    return {
      calls: this.calls,
      promptTokens: this.promptTokens,
      completionTokens: this.completionTokens,
      totalTokens: this.promptTokens + this.completionTokens,
    };
  }
}

export const governor = new TokenGovernor();

/**
 * One chat completion. Returns the whole assistant message, plus usage and
 * latency, and never throws on a shape it does not like.
 */
export async function chat({
  messages,
  tools,
  toolChoice,
  parallelToolCalls,
  maxTokens = 300,
  temperature = 0,
  model = TEXT_MODEL,
  reasoningEffort,
}) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return { ok: false, reason: "no-key", status: 0 };

  const payload = { model, messages, temperature, max_tokens: maxTokens };
  if (tools) payload.tools = tools;
  if (toolChoice) payload.tool_choice = toolChoice;
  if (parallelToolCalls !== undefined) payload.parallel_tool_calls = parallelToolCalls;
  if (reasoningEffort) payload.reasoning_effort = reasoningEffort;

  await governor.reserve(maxTokens + estimatePrompt(payload));

  const { res, ms, attempts, error, tls } = await fetchRetry(
    URL_CHAT,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify(payload),
    },
    { retries: 3, retryOn429: false }
  );

  if (!res) return { ok: false, reason: "unreachable", error, ms, attempts, tls, status: 0 };

  const { json, text } = await readBody(res);
  if (!res.ok) {
    return {
      ok: false,
      reason: "http",
      status: res.status,
      errorBody: json?.error ?? text,
      ms,
      attempts,
      tls,
      res,
      text,
    };
  }

  const usage = json?.usage;
  if (usage) governor.record(usage);

  const choice = json?.choices?.[0];
  return {
    ok: true,
    status: res.status,
    message: choice?.message ?? null, // the WHOLE message — content may be null
    finishReason: choice?.finish_reason ?? null,
    usage,
    raw: json,
    ms,
    attempts,
    tls,
  };
}

/** Rough prompt size, only used to decide how much budget to reserve. */
function estimatePrompt(payload) {
  return Math.ceil(JSON.stringify(payload).length / 3.6);
}

/** The free model-catalogue call. Our canary for a retired model id. */
export async function listModels() {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return { ok: false, reason: "no-key" };
  const { res, ms, attempts, error, tls } = await fetchRetry(URL_MODELS, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!res) return { ok: false, reason: "unreachable", error, ms, attempts, tls };
  const { json, text } = await readBody(res);
  return { ok: res.ok, status: res.status, json, text, ms, attempts, tls };
}

/** First tool call on a message, or null. Tolerates every shape Groq returns. */
export function firstToolCall(message) {
  const calls = message?.tool_calls;
  if (!Array.isArray(calls) || calls.length === 0) return null;
  const c = calls[0];
  let args = null;
  let argsError = null;
  try {
    args = JSON.parse(c?.function?.arguments ?? "{}");
  } catch (e) {
    argsError = String(e?.message ?? e);
  }
  return { id: c?.id, name: c?.function?.name, rawArgs: c?.function?.arguments, args, argsError };
}
