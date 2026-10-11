# Dry-run verification harness

Exercises every external integration and reports **what actually came back**.
Built before the agentic voice layer, because that plan rests on about a dozen
assumptions nobody had tested — and three of them turned out to be wrong.

Plain `.mjs`, `node:*` builtins plus `@supabase/supabase-js` (already a
dependency). No test runner, no new packages, not wired into `package.json` —
the same convention as `scripts/check-validation.mjs`.

## Running it

```bash
node scripts/dryrun/run.mjs                    # upstream + model. Nothing needs to be running.
node scripts/dryrun/run.mjs --only model       # just the agentic assumptions
node scripts/dryrun/run.mjs --contract         # + our own /api routes
node scripts/dryrun/run.mjs --speech --full    # + TTS→Whisper round trip, all 9 locales
node scripts/dryrun/run.mjs --with-writes      # + throwaway accounts against the live project
node scripts/dryrun/run.mjs --reap             # delete anything a crashed run left behind
```

Start these yourself first, where the flags need them:

```bash
npx next build && npx next start                                          # --contract
cd ml && .venv/Scripts/python.exe -m uvicorn server:app --port 8008        # --speech
```

**Not `next dev`.** It compiles per route on first visit (5–13 s), and every
latency in the report would be a compile time. Preflight warns when the target
looks like a dev server, and again when `.next` is older than `src/`.

## Reading the report

Pass/fail is the wrong vocabulary here. `src/lib/inference.ts` says it plainly —
*absent is a normal state, not a fault* — and several integrations are meant to
be missing. So every probe declares which statuses count as success **for it**:

| status | meaning |
|---|---|
| `live` | configured, reached, real data |
| `cached` | correct, served from a store rather than the wire |
| `fallback` | the designed degraded path ran |
| `absent` | deliberately not configured, and it degraded cleanly |
| `degraded` | reachable but wrong, thin or slow |
| `fail` | configured and broken, or a security assertion violated |
| `skip` | a precondition was unmet — no information either way |

`absent` is a pass for `/api/tts` with no inference server, and a failure for
`/api/market`, which has a key. Same word, opposite verdict, driven by the
probe's own `expected` list. A `!` in the left column means the outcome did not
match what that probe expected.

`evidence` is always the observed value — the provider name, the SQLSTATE, the
token count — never a boolean. Reports land in `out/` (gitignored) as JSON for
diffing between runs and markdown for reading.

## Why two layers

**Upstream** probes call the third party directly. **Contract** probes call our
own routes. Read together, a failure names its owner without a debugger:

| upstream | contract | conclusion |
|---|---|---|
| live | live | healthy end to end |
| live | fail / fallback | **our code** |
| fail | fallback | credential or outage, and the degradation worked |
| live | skip | app not running — no information about our code |

This earned itself immediately: Agmarknet returned 43 records while `/api/market`
reported `isRealData: false`.

## The write suite

`--with-writes` creates two farmers via the Admin API (`POST /auth/v1/admin/users`
with `email_confirm`, so it never depends on — or alters — the project's
`mailer_autoconfirm` setting), signs in with the anon key exactly as the app
does, asserts, and deletes everything.

Assertions are on **SQLSTATE codes**, not on "it errored":

- `42501` — RLS refused it (migration 021's ownership walk)
- `23514` — a CHECK constraint refused it (migration 017's pH bounds)

The distinction is the point. "pH 15 was refused" is only meaningful if `23514`
fired; had RLS caught it first, the bound itself would still be untested.

Safety: every created id is appended to `out/orphans.json` **before** any
assertion runs, teardown is in a `finally`, a sweeper clears leftovers at the
start of each run, and `--reap` cleans up after a `kill -9`. Teardown deletes by
captured id only — nothing here can express "delete where farmer_id is something
else".

## Adding a probe

Return the standard shape from `runProbe`:

```js
out.push(await runProbe(
  { id: "layer.thing", layer: "upstream", title: "…", expected: [STATUS.LIVE] },
  async () => ({ status, ms, evidence, verdict })
));
```

`verdict` is one line a human reads, and it must **name the observed value**:
`"200 in 412ms; 68 models; gpt-oss-120b present"` beats `"ok"`.

## Known traps this harness works around

- **Groq TLS.** `api.groq.com` serves an incomplete certificate chain on roughly
  one connection in three on this machine and Node does not chase AIA, so
  requests throw `UNABLE_TO_VERIFY_LEAF_SIGNATURE`. `lib/fetchx.mjs` retries and
  counts them; without that the harness reports outages that are not happening.
- **`readGroqContent()` cannot read a tool call.** It throws when `content` is
  empty, which is exactly what a tool call is. `lib/groq.mjs` returns the whole
  message instead.
- **Whisper normalises numbers to digits.** "two thousand rupees" comes back as
  "2,000 rupees". A naive word diff scores a perfect transcription as a failure.
  The speech suite checks the amount as a *value*, tolerant of a character slip.
- **The ThingSpeak demo channel.** `configured: true` proves nothing; the probe
  compares the configured id against the hardcoded `3469748` fallback.
- **Rate limits.** The limiter probe uses body-less posts to `/api/soil-reading`,
  because `checkRateLimit` runs before auth and before `formData()` — so it
  proves the limiter end to end at zero upstream cost. It runs last, since it
  leaves the caller's bucket spent for up to a minute.

## Multilingual accuracy benchmark

`accuracy.mjs` is a separate entry point (not one of the `run.mjs` suites) that
measures Whisper transcription accuracy across 8 non-English locales, 4
utterance classes, and 4 prompt strategies — bypassing `/api/transcribe`
entirely to call Groq's Whisper endpoint directly, since the point was
comparing strategies against each other, independent of whatever the route
happened to ship at the time.

```bash
node scripts/dryrun/accuracy.mjs                    # all 8 locales, all 4 variants (~25 min)
node scripts/dryrun/accuracy.mjs --locale kn,ta      # just these locales
node scripts/dryrun/accuracy.mjs --class money       # just this utterance class
node scripts/dryrun/accuracy.mjs --variant vocab     # just this variant (+ "none" control)
```

Ground truth lives in `fixtures/phrases.mjs`, prompt variants in
`lib/prompts.mjs`, entity-token scoring in `lib/score.mjs`. **Groq's Whisper
endpoint caps at 20 requests/minute** — tighter than the chat endpoint the rest
of this harness assumes — so `accuracy.mjs` has its own rolling-window
throttle; a harness error (429 exhausted, network blip) is excluded from every
average rather than scored as a zero, and the report says how many cells were
skipped so a polluted run can never look clean.

The result of the last full run is shipped in `src/lib/transcribePrompts.ts`.
Re-run before changing the Whisper model or adding a locale.
