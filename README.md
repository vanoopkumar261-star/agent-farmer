# Agent Farmer 🌱

**An autonomous farming OS** — an AI companion for every farmer that spots disease, answers questions, and turns field data into decisions, in **nine Indian languages**. Includes **Jaivik Sathi** (*जैविक साथी*, "A Companion of the Soil"), the "Future Us" concept for a solar-powered, sensor-instrumented on-farm bio-input production unit.

> MSME Idea Hackathon 6.0 · Industry 4.0 & 5.0 · Agriculture & Allied Industries

---

## ✨ What's inside

- **Landing site** — editorial marketing pages (home, about, team, architecture) with a layered, textured design system.
- **Jaivik Sathi** (`/jaivik-sathi`) — a cinematic, forest-green concept page (floating rock imagery, Lenis smooth scroll, scroll parallax, live charts) presenting the bio-input unit.
- **Dashboard** (`/dashboard`) — the farmer app: crops, AI assistant, disease scanner, market prices, government schemes, farm-input price comparison, expenses, store locator.
- **AI features** — LLM assistant, crop-disease advisory, market/scheme matching (Groq), plus an optional hybrid-CNN image scanner (PyTorch).
- **Live web layer** ([TinyFish](#-tinyfish--the-live-web-layer)) — a Search → Fetch → Web Agent ladder that reads the parts of the Indian agri web that have no API: state scheme portals, agri-input storefronts, and real farming news.
- **i18n** — 9 languages (English, Hindi, Kannada, Tamil, Telugu, Malayalam, Marathi, Bengali, Punjabi) via a lightweight `useT` / `<T>` system.

## 🧰 Tech stack

| Area | Tools |
|---|---|
| Framework | Next.js 14 (App Router), React 18, TypeScript |
| Styling | Tailwind CSS |
| Motion / 3D | Framer Motion, Lenis (smooth scroll), three.js + react-three-fiber + drei |
| Data viz | Recharts |
| Maps | Leaflet / react-leaflet |
| Backend | Supabase (Postgres, auth), Next.js API routes |
| AI | Groq (LLM) · PyTorch (disease-detection CNN, in `ml/`) |
| Live web | TinyFish (Search · Fetch · Web Agent) |

## 🚀 Getting started

**Prerequisites:** Node.js 18+ and npm.

```bash
# 1. Install dependencies
npm install

# 2. Set up environment variables
cp .env.example .env.local
#   then fill in your Supabase + Groq values (see .env.example)

# 3. Run the dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

**Scripts:** `npm run dev` · `npm run build` · `npm run start` · `npm run lint`

## 🔑 Environment variables

All config lives in `.env.local` (gitignored). See **[`.env.example`](./.env.example)** for the annotated list.

| Variable | Required | Purpose |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | **yes** | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | **yes** | Supabase public key (safe in the browser) |
| `SUPABASE_SERVICE_ROLE_KEY` | **yes** | Server-only DB access — bypasses RLS, keep secret |
| `GROQ_API_KEY` | **yes** | LLM assistant, disease advisory, market & scheme matching |
| `GROQ_VISION_MODEL` | no | Override the multimodal model id if Groq retires the default |
| `DATA_GOV_API_KEY` | no | Live Agmarknet mandi prices; without it, prices are labelled "estimated" |
| `RESEND_API_KEY` | no | Emails you when someone submits the landing-page feedback form |
| `FEEDBACK_NOTIFY_TO` | no | Inbox for that alert (required if `RESEND_API_KEY` is set) |
| `INFERENCE_URL` | no | The Python disease/TTS server, if you host one |
| `TINYFISH_API_KEY` | no | Live scheme desk, input-price comparison and the news fallback — see [TinyFish](#-tinyfish--the-live-web-layer) |
| `TINYFISH_AGENT_ENABLED` | no | Set to `0` to disable the paid browser tier while Search and Fetch keep working |

Admin-only DB migration tokens (`SUPABASE_ACCESS_TOKEN`, `SUPABASE_PROJECT_REF`) go in `.env.admin.local`.

Every optional variable degrades honestly rather than breaking: no `DATA_GOV_API_KEY` means prices are shown as estimates, no `RESEND_API_KEY` means feedback is still stored and the confirmation says so instead of claiming you were notified, no `INFERENCE_URL` means the disease scanner uses the Groq vision model alone, and no `TINYFISH_API_KEY` means the schemes page serves its built-in catalogue and the input-price page says so plainly.

## 🐟 TinyFish — the live-web layer

Four features in this app need data that **exists only as websites**. India
publishes its agriculture schemes as state department pages, its farm-input
prices as storefronts, and its mandi boards as pages that lose half their
content to a plain HTTP read; none has a usable API, and several of the pages
involved cannot be read with `fetch` and an HTML parser at all. TinyFish is how
the app reads them.

All of it goes through one client, **[`src/lib/tinyfish.ts`](./src/lib/tinyfish.ts)**,
which wraps Search, Fetch and the Web Agent and adds the thing that actually
matters: **a ladder**.

### The ladder

TinyFish's tiers differ in price by about fifty times. Search and Fetch are
free; the Web Agent bills **$0.016 per step**, and a step is roughly five
seconds of a real cloud browser. So the app climbs:

```
Search (free)  →  Fetch (free)  →  Web Agent (paid)
```

and the paid rung runs **only when the free rungs have provably failed on this
exact URL, in this exact request**. `runLadder()` makes that escalation a
first-class object rather than an if/else: every rung records what it cost, how
long it took, and why the next one was or was not tried. That record is returned
to the client as `ladder`, printed in the UI under "How we got this", and logged
as one line per request:

```
tf/input-prices: cache 0.0s miss → search 1.1s hit(3/3 sites located, 1 priced snippets)
                 → fetch 1.9s miss(1/1 read, 0 quotes)
                 → agent 45.0s hit(2 steps, 5 products) $0.032
```

### Why each tier is where it is — measured, not assumed

Every placement below came from running the APIs against the real sites
(2026-10-20), not from reading their HTML:

| Target | Free Fetch result | Verdict |
|---|---|---|
| `chitradurga.nic.in`, `schemesinindia.in` | 5–13 KB of clean markdown | **Fetch is enough** |
| `agribegri.com` *product* pages | 13 198 chars, 240 rupee amounts | **Fetch is enough** |
| `agribegri.com` *category* pages | 1 777 chars, 0 prices | client-rendered |
| `bighaat.com/collections/...` | renders, but says "No products found" | **Agent required** |
| `myscheme.gov.in/search/...` | 222 chars — page chrome and footer | SPA |
| `agmarknet.gov.in` | `target_http_error` 403 | blocked |
| `mandipulse.com/mandi-bhav/<state>/<crop>` | 200 ms, full price table — **but the mandi-name column is dropped** | **Agent required** |
| `acrop.app/prices/<crop>/<state>` | median, reporting count, named high and low | **Fetch is enough** |
| `vegetablemarketprice.com/market/<state>/today` | 54 vegetables, wholesale **and retail** ₹/kg | **Fetch is enough** |
| `commodityonline.com/mandiprices/...` | `bot_blocked`; a browser run *did* work, at 14 steps / 116 s | works, **declined on price** |
| `hellokisaan.com/mandirates/...` | renders, but every price is ₹0 | placeholder data, excluded |

The BigHaat row is the clearest demonstration, because it was confirmed from
both sides. Fetch reads that URL and finds no products — the listing is
assembled in the browser. A Web Agent run against the *identical* URL returned
five real products with prices and working links (run
`56796963-b2e8-43b5-977b-8878d97f927f`): *Eureka Super Napier Grass Forage
Seeds, ₹670/500 g*; *Gentex Bhima Shakti Onion Seeds, ₹2,729/1 kg*; and three
more. Same URL, same moment, one tier blind and the other not.

**Where we removed the agent.** There was a fourth integration pointed at
`myscheme.gov.in`, on the reasonable theory that a SPA is exactly what a browser
agent is for. It was measured and deleted: the run completed in 3 steps and 70
seconds and returned `{"schemes": []}`. It would have cost ~5 cents per attempt
to add nothing, on a path that exceeds the 60-second serverless ceiling anyway.
The scheme desk ships with the free tiers only, and the comment in
[`src/lib/schemeDesk.ts`](./src/lib/schemeDesk.ts) records why. We would rather
show a working free tier than a paid one that does not work.

### What it's used for

**1 · Live scheme desk — `/dashboard/schemes`** · *Search + Fetch, free*

`src/lib/schemes.ts` was eight hardcoded central schemes with deadlines stored
as literal strings. A farmer in Karnataka never saw Krishi Bhagya. Now Search
finds state agriculture-department pages, Fetch reads them, and Groq *reformats*
— never invents — what they say. A Karnataka run returns **Krishi Bhagya,
Bhoochetna, Karnataka Raita Suraksha, Organic Farming** and four more, in ~25
seconds for **$0.00**, cached for 7 days. The built-in eight remain as a floor
that is never replaced, and with no API key the page behaves exactly as before.

**2 · Honest news — `/dashboard/news`** · *Search, free*

The third tier of `/api/news` used to be a Groq call that **wrote** plausible
farming headlines: invented outlets, timestamps counted backwards from now, and
`url: "#"` so nothing could be clicked and checked. It is gone. TinyFish Search
(`domain_type: "news"`, 72-hour window, `location: "IN"`) supplies real,
clickable, dated articles, held to the same ranking and relevance gate as the
paid news APIs. Where Search gives no date the card says "Date not given" rather
than stamping today, and stock photos are labelled as stock.

**3 · Input price comparison — `/dashboard/inputs`** · *Search → Fetch → **Agent***

The feature the paid tier earns. A farmer buying urea or tomato seed can compare
what the online stores charge; `scripts/probe-input-sites.mjs` decides per site
whether Fetch suffices or a browser is needed, and each entry in
`src/lib/inputPrices/sites.ts` carries the measurement that decided it. Sites
that cannot be read are **named** in the results with the reason, never silently
omitted.

Because measured agent runs take 70–166 seconds against a 60-second function
ceiling, this one is **asynchronous**: `POST` runs the free rungs and starts a
browser run, `GET ?runId=` polls it. The run outlives the request, which is the
only arrangement where a platform timeout cannot kill work the wallet has
already paid for. Run ownership is recorded in Postgres, so a run id cannot be
used by another account to collect work it did not pay for.

**4 · Live mandi comparison — `/dashboard/market`** · *Fetch → **Agent***

The feature that used to be broken. This route drove a browser at
`agmarknet.gov.in`; the agent worked and the site did not yield — Agmarknet 2.0
serves prices from an API behind a guest-OTP login, and two measured runs
(17 steps/89 s, 33 steps/166 s) both came back `COMPLETED` with
`{"mandis": []}`. Every click spent credit to produce nothing and then fell
through to the data.gov.in feed, so what a visitor saw demonstrated was the
fallback.

It now reads sources that do yield, and the free/paid split is the cleanest in
the project because **both tiers read the same URL in the same request**. Free
Fetch gets MandiPulse's state page in ~200 ms with the full summary and every
row's min/modal/max — but the rendering drops the mandi-name column, so row one
reads "Mysuru" (a district) where "Nanjangud APMC" belongs. Prices without the
market that quoted them are not actionable: a farmer cannot drive to a
district. A browser run on that identical URL returns all 14 names, and its
prices match the free read row for row.

That agreement is also the validator: **an agent row whose modal price does not
appear in the free markdown is dropped.** The two tiers corroborate each other
by construction.

The new thing on screen is the **wholesale-vs-retail spread** — the one axis the
official feed cannot provide. *Tomato · Karnataka · 19 Oct: mandi median
₹16.2/kg, shops ₹49/kg, about 33% reaches the farmer.* It renders only when both
numbers are real and dated.

Honesty note: MandiPulse and ACROP both republish AgMarkNet, the same upstream
the data.gov.in floor reads. They are a better *view* of it, not an independent
one, and the card says "AgMarknet-derived" rather than implying corroboration.

**5 · Nightly warm — `/api/cron/tinyfish-warm`** · *free tiers only*

Every feature above is cache-first, and the cache used to be filled by whoever
happened to ask: a farmer in Bihar met an empty cache, waited ~25 seconds and
sometimes got nothing. Since the answer is identical for everyone in a state,
making each of them discover it individually is the wrong shape.

A GitHub Actions job ([`tinyfish-warm.yml`](./.github/workflows/tinyfish-warm.yml))
drains a work queue overnight — 31 states' scheme desks, the common input terms,
and 36 crop/state mandi boards. It runs **`allowAgent: false` everywhere**, so a
full pass costs **$0.00**; the workflow fails the job if it ever spends more than
50 cents, so a paid rung leaking into the cron path is loud rather than
expensive. A measured full pass: **75 targets, 11 invocations, 0 failures, $0.00**.

It lives in Actions rather than `vercel.json` because Vercel Cron on the Hobby
plan runs once a day and cannot call one endpoint repeatedly — the same reason
the hazard poller does, and it shares that route's `CRON_SECRET` check
([`src/lib/cronAuth.ts`](./src/lib/cronAuth.ts)).

A farmer pressing **Compare live prices** still escalates to the browser,
because `startLiveMandi` ignores a cached answer that has no mandi names.

### The key pool

The hackathon grant is five API keys with their own quotas, and `apiKey()` read
one environment variable — so four fifths of it was unreachable. `TINYFISH_API_KEYS`
is now a comma-separated pool ([`src/lib/tfKeys.ts`](./src/lib/tfKeys.ts)).

Selection is **least-loaded-first**, read from the `tf_key_ledger` table,
because module state cannot work here: every serverless cold start would begin
at the same key. On a `402 INSUFFICIENT_CREDITS` or `401 INVALID_API_KEY` the
key is passed over for six hours and the call retries once on the next key.

"Load" counts every billable unit — searches, fetch URLs and agent steps —
rather than dollars, and that distinction was measured rather than reasoned.
Ranking on `spend_usd` alone put **all 425 calls of a full warm on one key**,
because only agent steps move that column, so four keys tied at $0.0000 and the
index tie-break won every time: a pool that was single-key for free traffic.
Counting units, and counting picks already issued against the few-second ledger
snapshot, the same warm distributes **25 / 26 / 24 / 25 percent** across four
keys.

That retry looks like a violation of the project's `retries: 0` rule for
billable calls, and is not: **402 and 401 are rejected before a browser is
allocated**, so nothing is executing and nothing is on the invoice. Every other
status keeps the original rule.

Nobody has told us what a "credit" is — a step, a cent, a dollar, or something
the free tiers also consume. So the ledger counts `agent_steps`, `searches` and
`fetch_urls` separately alongside dollars at the one published rate, and the
unit becomes measurable instead of assumed.

Collecting a run uses the key that started it: `mandi_runs.key_index` and
`input_price_runs.key_index` exist because TinyFish resolves a run id only for
the account that created it, so polling with a sibling key would 404 work that
has already been paid for.

### Spending controls

A browser run costs real money, so:

- **`TfBudget` refuses a run before it starts.** Cost is estimated from the only
  lever the API exposes — the duration cap, at a measured ~5 s/step — and
  checked against a per-request ceiling ($0.20 for schemes, $0.35 for a 90-second
  storefront run). There is no refund for discovering the price afterwards.
- **`retries: 0` on every agent call.** `/run` cannot be cancelled, so a retry
  starts a *second* billable run. Search and Fetch, being free and idempotent,
  keep the normal retry.
- **Cache first, always.** 7 days for schemes, 12 hours for prices. A cached
  answer is a DB read, not a spend.
- **Billable paths are button-pressed, never on mount**, and rate-limited
  (schemes 6 / 5 min, input prices 4 / 5 min). Polling has its own looser budget
  so a successful lookup cannot rate-limit its own result.
- **`TINYFISH_AGENT_ENABLED=0`** disables the paid tier while Search and Fetch
  keep working — the on-stage panic button, no redeploy needed.
- Every TinyFish-calling route is **session-gated**. `/api/live-mandi`, the one
  billable endpoint that was still open, was closed as part of this work.

### Never a fact we did not read

Both new features pass model output through validators written in code, not
prompt wording:

- **Schemes:** a scheme whose `link` host is not one of the pages we actually
  fetched is **dropped**. Asked for scheme links, a model will happily mint
  `https://karnatakaagri.gov.in/krishi-bhagya` — it looks right and it 404s.
  Deadlines and rupee amounts are never inferred; an empty field renders as
  "the source page did not state this".
- **Prices:** extraction is a deterministic regex over the fetched markdown. A
  price that does not appear in the page is not shown. A farmer comparing ₹149
  against ₹1,727 deserves both numbers to be real.

### Try it

```bash
# Tier 1 — Search (free)
curl -s -G "https://api.search.tinyfish.ai" -H "X-API-Key: $TINYFISH_API_KEY" \
  --data-urlencode "query=Karnataka government agriculture scheme subsidy for farmers" \
  --data-urlencode "location=IN" --data-urlencode "domain_type=web" | jq '.results[].url'

# Tier 2 — Fetch (free), and the proof the paid tier is sometimes necessary
curl -s -X POST "https://api.fetch.tinyfish.ai" -H "X-API-Key: $TINYFISH_API_KEY" \
  -H 'Content-Type: application/json' \
  -d '{"urls":["https://chitradurga.nic.in/en/agriculture/","https://www.myscheme.gov.in/search","https://agmarknet.gov.in/"],"ttl":0}' \
  | jq '{ok:[.results[]|{url,len:(.text|length)}], errors}'

# Which storefronts need a browser, and why
node scripts/probe-input-sites.mjs "urea fertiliser"

# The mandi page both tiers read. Note the full price table AND the missing
# mandi-name column -- that gap is the entire justification for the paid rung.
curl -s -X POST "https://api.fetch.tinyfish.ai" -H "X-API-Key: $TINYFISH_API_KEY"   -H 'Content-Type: application/json'   -d '{"urls":["https://mandipulse.com/mandi-bhav/karnataka/tomato"],"ttl":0}'   | jq -r '.results[0].text' | sed -n '/Mandi-wise/,/^$/p'

# A full nightly warm, locally. Should report spentUsd 0.
curl -s -X POST -H "Authorization: Bearer $CRON_SECRET"   "http://localhost:3000/api/cron/tinyfish-warm?seed=1" | jq
```

In the app: open `/dashboard/schemes` and press **Check for new schemes**,
`/dashboard/inputs` and compare `tomato seeds`, or `/dashboard/market` and press
**Compare live prices** — then open **How we got this** on any of them to see
the ladder and what the lookup cost.


## 🗄️ Database setup

The schema is a numbered set of SQL migrations in `scripts/sql/`, applied in order against a fresh Supabase project:

```bash
# Put SUPABASE_ACCESS_TOKEN + SUPABASE_PROJECT_REF in .env.admin.local first
for f in scripts/sql/*.sql; do node scripts/db-exec.mjs "$f"; done
```

They create the task and notification tables, the feedback table, the rate-limit and audit tables, and apply per-owner row-level security across all of them. Later migrations assume the earlier ones have run, so apply them in filename order.

The four core tables — `farmer_profiles`, `farms`, `crop_cycles`, `farm_expenses` — were originally created by hand in the Supabase dashboard and had no `CREATE TABLE` in this history. `019_baseline_owner_tables.sql` backfills their definitions (generated from the live schema) and, more importantly, the `enable row level security` statements that were never tracked anywhere. `scripts/sql/008_mandi_geocache.sql` has never been applied to the live project — `schema_migrations` records what has.

**One Supabase setting matters for local setup:** under **Authentication → Providers → Email**, "Confirm email" must be **OFF** to develop without SMTP — with it on, `signUp` returns no session and registration appears to hang.

> ⚠️ That is a development convenience, not a production setting. With confirmation off, anyone can register any address they do not own and immediately hold an `authenticated` session. Before going live, configure SMTP and turn it **ON** — see the checklist in [SECURITY.md](SECURITY.md), which is the authority for production auth settings.

When you deploy, also add your production URL under **Authentication → URL Configuration → Redirect URLs**.

## ▲ Deploying to Vercel

The app is a standard Next.js 14 App Router project with no custom build step — Vercel detects it and needs no `vercel.json`.

1. Push this repo to GitHub.
2. In Vercel, **Add New → Project** and import it. Framework preset: **Next.js**. Leave the build command and output directory at their defaults.
3. Add the environment variables from the table above under **Settings → Environment Variables** (at minimum the four marked *yes*), for the Production and Preview environments.
4. Deploy, then add the resulting `https://<your-app>.vercel.app` to Supabase's **Redirect URLs** so auth works on the deployed domain.

`.vercelignore` keeps `ml/`, `docs/` and `scripts/` out of the upload — none of them are imported by the app.

**What does not run on Vercel:** the PyTorch disease classifier and MMS-TTS voice in `ml/`. Both need a persistent process and hundreds of megabytes of weights, which a serverless function is not. Leave `INFERENCE_URL` unset and the app skips them cleanly — disease scanning falls back to Groq's vision model, and speech falls back to the browser's own voices. Host `ml/server.py` somewhere with a long-lived process (Railway, Render, a VM) and point `INFERENCE_URL` at it to enable both.

## 📁 Project structure

```
src/
  app/               # App Router routes
    page.tsx         # Home (landing)
    jaivik-sathi/    # "Future Us" concept page
    dashboard/       # Farmer app (crops, assistant, disease, market, …)
    about, team, architecture, onboarding/
    api/             # Route handlers (chat, disease, market, schemes, …)
  components/        # UI kit, dashboard widgets, landing, i18n, 3D
  lib/               # Supabase, Groq, data helpers, i18n dictionaries
ml/                  # PyTorch disease-detection model + FastAPI server
public/              # Images, team photos, videos, 3D model
scripts/             # DB migrations (sql/) + helper scripts
docs/                # Technical documentation
```

## 🧠 Disease-detection ML server (optional)

The image scanner prefers a hybrid CNN trained on PlantVillage, served from `ml/` by FastAPI:

```bash
cd ml
python -m venv .venv && .venv/Scripts/activate    # macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt                    # or: torch torchvision fastapi uvicorn pillow
python -m uvicorn server:app --host 127.0.0.1 --port 8008
```

Locally the app finds it on port 8008 with no configuration. Anywhere else, set `INFERENCE_URL`. It is entirely optional — when it is absent the scanner uses Groq's vision model instead and says so in the result.

> The bundled MMS-TTS voice is **CC-BY-NC** (non-commercial). It must be swapped — `ai4bharat/indic-parler-tts` is the Apache-2.0 equivalent — before this is used commercially.

## 👥 Team

**Anoopkumar V** — Team Lead · LLM Developer & 3-D Designer · **Barsha Sharma** — Content Researcher & Tester · **Sahajtha Singh** — UI Designer & Curator · **Shiven Chopra** — i18n Architect & Designer · **Manan Agrawal** — Database Manager & Backend Developer

## 🙏 Credits

- Jaivik Sathi hero 3D rock model: [Poly Haven](https://polyhaven.com) (CC0).
- Nature/product imagery: AI-generated for this project.

---

*Private project — MSME Idea Hackathon 6.0.*
