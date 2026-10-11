/**
 * The model suite — the probes that matter most, because the entire agentic
 * plan rests on answers nobody has ever measured.
 *
 * Eight questions:
 *   M0  does a tool call really arrive as `content: null`, making
 *       readGroqContent() unusable for the agent loop?
 *   M1  does gpt-oss-120b emit a well-formed tool call at all?
 *   M2  does parallel_tool_calls:false actually hold — WITH a control, because
 *       "one call came back" proves nothing if the model never wanted two?
 *   M3  does it respect a strict enum, and does Groq accept `strict: true`?
 *   M4  does feeding a tool result back produce a faithful answer — and, the
 *       one that matters, does a FAILED tool result make it invent a number?
 *   M5  does it still call tools correctly in Hindi and Kannada, and do the
 *       ARGUMENTS stay ASCII rather than leaking Devanagari into a lookup key?
 *   M6  what does it do when the capability does not exist?
 *   M7  what does the tool schema block cost in prompt tokens?
 */
import { STATUS, runProbe } from "../lib/probe.mjs";
import { chat, firstToolCall, listModels, TEXT_MODEL, governor } from "../lib/groq.mjs";
import { clip, sleep } from "../lib/fetchx.mjs";

const CROPS = ["tomato", "onion", "potato", "wheat"];

/** Two tools shaped like the real app's registry, not toy examples. */
const TOOL_MANDI = {
  type: "function",
  function: {
    name: "get_mandi_price",
    description: "Look up today's mandi (wholesale market) price for a crop in an Indian state.",
    parameters: {
      type: "object",
      properties: {
        crop: { type: "string", enum: CROPS, description: "The crop to price." },
        state: { type: "string", description: "Indian state name in English." },
      },
      required: ["crop", "state"],
      additionalProperties: false,
    },
  },
};

const TOOL_WEATHER = {
  type: "function",
  function: {
    name: "get_weather_forecast",
    description: "Weather forecast for a location.",
    parameters: {
      type: "object",
      properties: {
        lat: { type: "number" },
        lng: { type: "number" },
        days: { type: "integer", minimum: 1, maximum: 7 },
      },
      required: ["lat", "lng"],
      additionalProperties: false,
    },
  },
};

const SYS = {
  role: "system",
  content:
    "You are a farming assistant for Indian farmers. When a tool can answer the question, call it rather than guessing. Never invent numbers.",
};

function fail(verdict, evidence, ms, attempts) {
  return { status: STATUS.FAIL, verdict, evidence, ms, attempts };
}

/** Shared guard: turn a non-ok Groq result into the right status. */
function groqProblem(r) {
  if (r.reason === "no-key") return { status: STATUS.ABSENT, verdict: "GROQ_API_KEY not set" };
  if (r.reason === "unreachable")
    return {
      status: STATUS.FAIL,
      verdict: `unreachable after ${r.attempts} attempts (${r.tls} TLS chain failures): ${r.error?.message ?? r.error}`,
      ms: r.ms,
      attempts: r.attempts,
    };
  if (r.status === 429)
    return { status: STATUS.SKIP, verdict: "Groq rate-limited this call", ms: r.ms, attempts: r.attempts };
  return {
    status: STATUS.FAIL,
    verdict: `HTTP ${r.status}: ${clip(r.errorBody?.message ?? r.errorBody, 200)}`,
    evidence: r.errorBody,
    ms: r.ms,
    attempts: r.attempts,
  };
}

export async function modelProbes() {
  const out = [];
  let m1Message = null;
  let m1Call = null;
  let m1Usage = null;

  // ── canary: is the model we depend on still in the catalogue? ────────────
  out.push(
    await runProbe(
      {
        id: "model.catalogue",
        layer: "model",
        title: "Groq still lists the models the app names",
        expected: [STATUS.LIVE],
      },
      async () => {
        const r = await listModels();
        if (!r.ok) {
          if (r.reason === "no-key") return { status: STATUS.ABSENT, verdict: "GROQ_API_KEY not set" };
          return {
            status: STATUS.FAIL,
            verdict: `models endpoint ${r.status ?? "unreachable"}`,
            ms: r.ms,
            attempts: r.attempts,
          };
        }
        const ids = (r.json?.data ?? []).map((m) => m.id);
        const want = [TEXT_MODEL, "whisper-large-v3-turbo"];
        const missing = want.filter((w) => !ids.includes(w));
        return {
          status: missing.length ? STATUS.FAIL : STATUS.LIVE,
          ms: r.ms,
          attempts: r.attempts,
          evidence: { count: ids.length, want, missing, sample: ids.slice(0, 12) },
          verdict: missing.length
            ? `${ids.length} models; MISSING ${missing.join(", ")}`
            : `${ids.length} models; ${want.join(" + ")} both present`,
        };
      }
    )
  );

  // ── M1 + M0: does a tool call arrive, and is content null? ───────────────
  out.push(
    await runProbe(
      {
        id: "model.toolcall.emit",
        layer: "model",
        title: "gpt-oss-120b emits a well-formed tool call",
        expected: [STATUS.LIVE],
      },
      async () => {
        const r = await chat({
          messages: [SYS, { role: "user", content: "What is today's price for tomato in Karnataka mandis?" }],
          tools: [TOOL_MANDI],
          toolChoice: "auto",
        });
        if (!r.ok) return groqProblem(r);

        m1Message = r.message;
        m1Usage = r.usage;
        const call = firstToolCall(r.message);
        m1Call = call;

        const evidence = {
          finish_reason: r.finishReason,
          content: r.message?.content,
          contentIsNull: r.message?.content === null,
          tool_calls: r.message?.tool_calls ?? null,
          usage: r.usage,
        };

        if (!call) {
          return fail(
            `no tool call — finish_reason=${r.finishReason}, model answered in prose instead`,
            evidence,
            r.ms,
            r.attempts
          );
        }
        if (call.name !== "get_mandi_price") return fail(`called "${call.name}"`, evidence, r.ms, r.attempts);
        if (call.argsError) return fail(`arguments not valid JSON: ${call.argsError}`, evidence, r.ms, r.attempts);
        const missing = ["crop", "state"].filter((k) => call.args?.[k] === undefined);
        if (missing.length) return fail(`arguments missing ${missing.join(", ")}`, evidence, r.ms, r.attempts);

        return {
          status: STATUS.LIVE,
          ms: r.ms,
          attempts: r.attempts,
          evidence,
          verdict: `${call.name}(${JSON.stringify(call.args)}) · finish_reason=${r.finishReason} · content=${JSON.stringify(r.message?.content)}`,
        };
      }
    )
  );

  // M0 is a pure assertion over M1's evidence — no extra tokens.
  out.push(
    await runProbe(
      {
        id: "model.readGroqContent.trap",
        layer: "model",
        title: "readGroqContent() would throw on a tool call",
        expected: [STATUS.LIVE],
      },
      async () => {
        if (!m1Message) return { status: STATUS.SKIP, verdict: "no M1 message to inspect" };
        const raw = m1Message.content;
        const wouldThrow = !raw;
        return {
          status: STATUS.LIVE,
          evidence: { content: raw, wouldThrow, hasToolCalls: Array.isArray(m1Message.tool_calls) },
          verdict: wouldThrow
            ? "CONFIRMED: content is empty on a tool call, so src/lib/http.ts readGroqContent() throws. The build needs readGroqMessage()."
            : "content was non-empty — readGroqContent() would survive, contrary to expectation",
        };
      }
    )
  );

  await sleep(1500);

  // ── M3a: enum pressure ───────────────────────────────────────────────────
  out.push(
    await runProbe(
      {
        id: "model.enum.pressure",
        layer: "model",
        title: "An out-of-enum crop never appears in arguments",
        expected: [STATUS.LIVE],
      },
      async () => {
        const r = await chat({
          messages: [SYS, { role: "user", content: "What is the price of brinjal in Karnataka today?" }],
          tools: [TOOL_MANDI],
          toolChoice: "auto",
        });
        if (!r.ok) return groqProblem(r);
        const call = firstToolCall(r.message);
        const evidence = {
          finish_reason: r.finishReason,
          tool_calls: r.message?.tool_calls ?? null,
          content: clip(r.message?.content, 300),
          emittedCrop: call?.args?.crop ?? null,
          enum: CROPS,
        };
        // Answering in prose is a perfectly good outcome. Inventing a value is not.
        if (!call) {
          return {
            status: STATUS.LIVE,
            ms: r.ms,
            attempts: r.attempts,
            evidence,
            verdict: `no tool call; answered in prose (finish_reason=${r.finishReason}) — acceptable, enum not violated`,
          };
        }
        if (!CROPS.includes(call.args?.crop)) {
          return fail(
            `emitted crop="${call.args?.crop}" which is OUTSIDE the enum — the gateway must validate, the model will not`,
            evidence,
            r.ms,
            r.attempts
          );
        }
        return {
          status: STATUS.LIVE,
          ms: r.ms,
          attempts: r.attempts,
          evidence,
          verdict: `coerced to in-enum "${call.args.crop}" rather than inventing "brinjal"`,
        };
      }
    )
  );

  await sleep(1500);

  // ── M2: parallel_tool_calls, WITH the control ────────────────────────────
  out.push(
    await runProbe(
      {
        id: "model.parallel.flag",
        layer: "model",
        title: "parallel_tool_calls:false holds — and the control says whether that means anything",
        expected: [STATUS.LIVE],
      },
      async () => {
        // Deliberately two explicit, independent errands. A vaguer prompt lets
        // the model do one thing and call it done, which makes the control
        // useless — it emits 1 either way and the flag looks proven when it
        // was never exercised.
        const ask = {
          role: "user",
          content:
            "Do both of these now: (1) look up today's tomato price in Karnataka, and (2) get the 3-day weather forecast for 12.30 N, 76.65 E. I need both answers together.",
        };
        const off = await chat({
          messages: [SYS, ask],
          tools: [TOOL_MANDI, TOOL_WEATHER],
          toolChoice: "auto",
          parallelToolCalls: false,
        });
        if (!off.ok) return groqProblem(off);
        await sleep(1500);
        const ctl = await chat({
          messages: [SYS, ask],
          tools: [TOOL_MANDI, TOOL_WEATHER],
          toolChoice: "auto",
        });

        const nOff = off.message?.tool_calls?.length ?? 0;
        const nCtl = ctl.ok ? ctl.message?.tool_calls?.length ?? 0 : null;
        const evidence = {
          withFlag: { count: nOff, names: (off.message?.tool_calls ?? []).map((c) => c.function?.name) },
          control: ctl.ok
            ? { count: nCtl, names: (ctl.message?.tool_calls ?? []).map((c) => c.function?.name) }
            : { error: ctl.status ?? ctl.reason },
          usage: { withFlag: off.usage, control: ctl.usage },
        };

        if (nOff > 1) {
          return fail(`parallel_tool_calls:false was IGNORED — ${nOff} calls came back`, evidence, off.ms, off.attempts);
        }
        // The whole reason the control exists.
        const meaningful = nCtl !== null && nCtl > 1;
        return {
          status: STATUS.LIVE,
          ms: off.ms,
          attempts: off.attempts,
          evidence,
          verdict: meaningful
            ? `flag held (1 call) and the control emitted ${nCtl} — the flag is doing real work`
            : `flag held (1 call) BUT the control also emitted ${nCtl} — the flag is untested, not proven`,
        };
      }
    )
  );

  await sleep(1500);

  // ── M4a: faithful round trip ─────────────────────────────────────────────
  out.push(
    await runProbe(
      {
        id: "model.roundtrip.faithful",
        layer: "model",
        title: "A tool result is reported back without distortion",
        expected: [STATUS.LIVE],
      },
      async () => {
        if (!m1Call) return { status: STATUS.SKIP, verdict: "M1 produced no tool call to build on" };
        const toolMsg = {
          role: "tool",
          tool_call_id: m1Call.id,
          name: "get_mandi_price",
          content: JSON.stringify({
            crop: "tomato",
            state: "Karnataka",
            modal_price: 2450,
            unit: "INR/quintal",
            mandi: "Mysuru",
            date: "2026-09-05",
          }),
        };
        const r = await chat({
          messages: [SYS, { role: "user", content: "What is today's price for tomato in Karnataka mandis?" }, m1Message, toolMsg],
          tools: [TOOL_MANDI],
          maxTokens: 400,
        });
        if (!r.ok) return groqProblem(r);
        const text = r.message?.content ?? "";
        const hasNumber = /2,?450/.test(text);
        const evidence = { finish_reason: r.finishReason, reply: clip(text, 600), usage: r.usage };
        if (!hasNumber) {
          return fail("the reply did not carry the 2450 the tool returned", evidence, r.ms, r.attempts);
        }
        if (r.message?.tool_calls?.length) {
          return fail("model called another tool instead of answering", evidence, r.ms, r.attempts);
        }
        return {
          status: STATUS.LIVE,
          ms: r.ms,
          attempts: r.attempts,
          evidence,
          verdict: `reported 2450 faithfully · finish_reason=${r.finishReason}`,
        };
      }
    )
  );

  await sleep(1500);

  // ── M4b: THE fabrication probe ───────────────────────────────────────────
  out.push(
    await runProbe(
      {
        id: "model.roundtrip.no_fabrication",
        layer: "model",
        title: "A FAILED tool result does not become an invented price",
        expected: [STATUS.LIVE],
      },
      async () => {
        if (!m1Call) return { status: STATUS.SKIP, verdict: "M1 produced no tool call to build on" };
        const toolMsg = {
          role: "tool",
          tool_call_id: m1Call.id,
          name: "get_mandi_price",
          content: JSON.stringify({ error: "upstream unavailable" }),
        };
        const r = await chat({
          messages: [SYS, { role: "user", content: "What is today's price for tomato in Karnataka mandis?" }, m1Message, toolMsg],
          tools: [TOOL_MANDI],
          maxTokens: 400,
        });
        if (!r.ok) return groqProblem(r);
        const text = r.message?.content ?? "";
        // A rupee-shaped number in a reply to a failed lookup is fabrication.
        const invented = text.match(/(?:₹|rs\.?\s*|inr\s*)\s?\d[\d,]{2,}/i);
        const evidence = { reply: clip(text, 600), inventedMatch: invented?.[0] ?? null, usage: r.usage };
        if (invented) {
          return fail(
            `FABRICATION: the tool failed and the model still produced "${invented[0]}" — a farmer would act on this`,
            evidence,
            r.ms,
            r.attempts
          );
        }
        return {
          status: STATUS.LIVE,
          ms: r.ms,
          attempts: r.attempts,
          evidence,
          verdict: "tool failed and the reply carried no price — no fabrication",
        };
      }
    )
  );

  await sleep(2000);

  // ── M5: Indic tool calling ───────────────────────────────────────────────
  for (const [locale, question, range] of [
    ["hi", "मैसूर मंडी में टमाटर का आज का भाव क्या है?", [0x900, 0x97f]],
    ["kn", "ಮೈಸೂರು ಮಂಡಿಯಲ್ಲಿ ಟೊಮೇಟೊ ಇಂದಿನ ಬೆಲೆ ಎಷ್ಟು?", [0xc80, 0xcff]],
  ]) {
    out.push(
      await runProbe(
        {
          id: `model.multilingual.${locale}`,
          layer: "model",
          title: `Tool call survives a question asked in ${locale}`,
          expected: [STATUS.LIVE],
        },
        async () => {
          const r = await chat({
            messages: [SYS, { role: "user", content: question }],
            tools: [TOOL_MANDI],
            toolChoice: "auto",
          });
          if (!r.ok) return groqProblem(r);
          const call = firstToolCall(r.message);
          const evidence = {
            question,
            finish_reason: r.finishReason,
            tool_calls: r.message?.tool_calls ?? null,
            content: clip(r.message?.content, 300),
            usage: r.usage,
          };
          if (!call) {
            return fail(
              `no tool call in ${locale} — the model answered in prose (this is the real risk: it works in English and silently degrades here)`,
              evidence,
              r.ms,
              r.attempts
            );
          }
          // The failure nobody catches: arguments in the caller's script.
          const crop = call.args?.crop;
          const nonAscii = typeof crop === "string" && /[^\x20-\x7E]/.test(crop);
          if (nonAscii) {
            return fail(
              `arguments leaked non-ASCII: crop="${crop}". Every downstream lookup keyed on this breaks silently.`,
              { ...evidence, emittedCrop: crop },
              r.ms,
              r.attempts
            );
          }
          if (!CROPS.includes(crop)) {
            return fail(`crop="${crop}" is outside the enum`, { ...evidence, emittedCrop: crop }, r.ms, r.attempts);
          }
          return {
            status: STATUS.LIVE,
            ms: r.ms,
            attempts: r.attempts,
            evidence: { ...evidence, emittedCrop: crop, scriptRange: range },
            verdict: `${locale}: ${call.name}(${JSON.stringify(call.args)}) — arguments stayed ASCII and in-enum`,
          };
        }
      )
    );
    await sleep(2000);
  }

  // ── M6: a capability that does not exist ─────────────────────────────────
  out.push(
    await runProbe(
      {
        id: "model.unknown.capability",
        layer: "model",
        title: "It does not invent a tool name for a capability we never gave it",
        expected: [STATUS.LIVE],
      },
      async () => {
        const r = await chat({
          messages: [
            SYS,
            { role: "user", content: "Book me a truck to carry 3 tonnes of onions to Bengaluru tomorrow morning." },
          ],
          tools: [TOOL_MANDI],
          toolChoice: "auto",
        });
        if (!r.ok) return groqProblem(r);
        const names = (r.message?.tool_calls ?? []).map((c) => c.function?.name);
        const invented = names.filter((n) => n !== "get_mandi_price");
        const evidence = {
          finish_reason: r.finishReason,
          names,
          invented,
          content: clip(r.message?.content, 400),
          usage: r.usage,
        };
        if (invented.length) {
          return fail(
            `invented tool name(s): ${invented.join(", ")} — the gateway MUST allowlist names; the model cannot be trusted to`,
            evidence,
            r.ms,
            r.attempts
          );
        }
        return {
          status: STATUS.LIVE,
          ms: r.ms,
          attempts: r.attempts,
          evidence,
          verdict: names.length
            ? `called only registered tools (${names.join(", ")})`
            : "declined in prose rather than inventing a tool",
        };
      }
    )
  );

  await sleep(1500);

  // ── M7: what does the schema block cost? ─────────────────────────────────
  out.push(
    await runProbe(
      {
        id: "model.budget.schema_overhead",
        layer: "model",
        title: "Prompt-token cost of registering tools, and turns-per-minute",
        expected: [STATUS.LIVE],
      },
      async () => {
        // A neutral prompt on purpose. We are measuring the prompt-token cost
        // of the schema block, and a question that tempts a tool call makes the
        // no-tools arm fail ("Tool choice is none, but model called a tool")
        // rather than measure anything.
        const ask = [SYS, { role: "user", content: "Reply with the single word: ok" }];
        const withTools = await chat({
          messages: ask,
          tools: [TOOL_MANDI, TOOL_WEATHER],
          toolChoice: "none",
          maxTokens: 60,
        });
        if (!withTools.ok) return groqProblem(withTools);
        await sleep(1200);
        const without = await chat({ messages: ask, maxTokens: 60 });
        if (!without.ok) return groqProblem(without);

        const a = withTools.usage?.prompt_tokens ?? 0;
        const b = without.usage?.prompt_tokens ?? 0;
        const overhead = a - b;
        const perTool = overhead / 2;
        // A three-step agent turn: schema+question, tool_call, tool result, final.
        // A real 3-step turn, measured rather than guessed: M1's actual prompt
        // (system + question + schemas) twice, because the second step resends
        // everything plus the tool result, plus both completions.
        const m1p = m1Usage?.prompt_tokens ?? a;
        const m1c = m1Usage?.completion_tokens ?? 0;
        const perTurn = m1p * 2 + m1c * 2;
        const turnsPerMinTokens = perTurn > 0 ? Math.floor(6000 / perTurn) : null;
        const turnsPerMinReqs = Math.floor(30 / 2);

        return {
          status: STATUS.LIVE,
          ms: withTools.ms + without.ms,
          evidence: {
            promptTokensWithTools: a,
            promptTokensWithoutTools: b,
            schemaOverheadTokens: overhead,
            approxPerToolTokens: Math.round(perTool),
            estimatedTokensPerAgentTurn: perTurn,
            basedOnM1Usage: m1Usage,
            turnsPerMinute: { byTokenCeiling: turnsPerMinTokens, byRequestCeiling: turnsPerMinReqs },
            binds: turnsPerMinTokens !== null && turnsPerMinTokens < turnsPerMinReqs ? "tokens" : "requests",
            latencyMs: { withTools: withTools.ms, without: without.ms },
          },
          verdict: `2 tool schemas cost ${overhead} prompt tokens (~${Math.round(perTool)}/tool); ~${perTurn} tokens per 3-step turn → ~${turnsPerMinTokens} turns/min on the free tier (${
            turnsPerMinTokens !== null && turnsPerMinTokens < turnsPerMinReqs ? "tokens bind" : "requests bind"
          })`,
        };
      }
    )
  );

  return { records: out, usage: governor.summary() };
}
