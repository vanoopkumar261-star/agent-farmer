# Agent Farmer — Developer Report

*A complete extraction of the project as it stands: every feature, every subsystem, every piece of infrastructure. Written for engineers picking this up cold — team members, future-you, or an outside reviewer.*

**Last extracted:** 2026-08-19 · **Branches:** `main` (deployed snapshot) + `feature/v2-voice-auth` (current work, includes real auth, voice, v2 redesign — see [Branch status](#0-branch-status))

---

## 0. Branch status

Two branches matter:

- **`main`** — the old deployed snapshot. Runs against Supabase with the *old* permissive RLS policies and has none of the real-auth, voice, or v2-design work.
- **`feature/v2-voice-auth`** — where all current work lives (pushed to origin). Real per-account auth, the redesigned "v2" light theme, the voice assistant, the market-page rewrite from a collaborator's fork, honesty passes on the dashboard's derived data, and the security hardening (private leaf-scan storage, real upload validation, rate limiting) described below.

Everything in this report describes `feature/v2-voice-auth` unless stated otherwise. **This branch has not yet been merged to `main` or redeployed** — the live Vercel deployment is behind.

There is also a second, independent remote: **`friend`** (`https://github.com/agrawalmanan/agent-farmer`, collaborator Manan Agrawal's fork). It shares **no git history** with this repo (single squashed commit built from an old snapshot) — anything pulled from it has to be lifted file-by-file with `git show friend/main:<path>`, not merged. The market page (`MarketBoard`, `MarketAdvice`, `TransportPlanner`) was integrated this way on 2026-08-15; his Terms/Privacy pages and additional settings are not yet integrated.

---

## 1. Product overview

**Agent Farmer** is an AI-first farming operating system for Indian farmers: a single account tracks one or more farms, and the app turns real field/market/weather data into daily guidance — what to do today, whether prices are good enough to sell, whether a leaf photo shows disease, which government schemes apply. It supports **nine Indian languages** (English, Hindi, Kannada, Tamil, Telugu, Malayalam, Marathi, Bengali, Punjabi) end-to-end in the UI, with AI features replying in the farmer's own language.

The project also carries a **second, forward-looking concept**: **Jaivik Sathi** (जैविक साथी, "A Companion of the Soil") — a proposed solar-powered, IoT-instrumented on-farm bio-input production unit (composting/vermicomposting at scale, with sensor-driven process control and traceability), built for the **MSME Idea Hackathon 6.0** (Industry 4.0/5.0, Agriculture). It is *not* built — it exists as a marketing/concept microsite (`/jaivik-sathi`) and a project document (`JaivikSathi_ProjectDocument_v2.docx`), described as "Agent Farmer's next phase." The relationship: everything already built in Agent Farmer (dashboard, disease detection, AI assistant, market data, expenses, i18n) is explicitly scoped in that document as the reusable "AI Engine + Farmer App" layer for Jaivik Sathi's eventual system architecture — the new work for that phase would be compost-process control, LoRaWAN sensor ingestion, an edge controller, and batch traceability/certification, none of which exists in code yet.

---

## 2. Feature inventory

### 2.1 Public / marketing pages

| Route | What it is |
|---|---|
| `/` | Landing home — video hero, feature/how-it-works/capability sections, a one-time boot-splash terminal animation, entry points into "I am a Farmer" (→ onboarding) and "Future Us" (→ `/jaivik-sathi`). |
| `/about` | Editorial About page — 1:1-inspired rebuild of a reference video in the site's palette: matted frame, drone-video-in-headline, team photo, stats, features accordion, roadmap. |
| `/architecture` | A scroll-driven 3D "dolly" tour of the *real* technical stack (Client → Application → Data → AI/ML → External/Infra), auto-mapped from the actual codebase, with clickable nodes showing real implementation details. |
| `/team` | Portrait grid with hover bios for the five team members. |
| `/oilseeds` | A short educational interstitial about oilseed cultivation shown once between the "I am a Farmer" CTA and registration; the farmer's ack is saved to their profile. |
| `/jaivik-sathi` | Standalone cinematic concept microsite for the future phase (see §1) — outsider-facing only, no internal economics. |
| `/onboarding` | Multi-step wizard: create account (or sign in) → farm details (area/soil/irrigation/location) → AI crop recommendations → confirm. |
| `/login` | Sign-in/sign-up. |

### 2.2 Dashboard (authenticated app, under `/dashboard`)

All nine screens share a persistent shell (`dashboard/layout.tsx`): sidebar nav, top bar, ambient background effects, and a floating AI assistant dock + voice-mode overlay available everywhere.

1. **`/dashboard`** — home: real weather, computed farm health score (with an explainable factor breakdown), today's tasks, alerts, market snapshot, expense summary, activity timeline, upcoming harvest countdown, AI daily summary.
2. **`/dashboard/crops`** — per-farm crop detail: growth stage (from the agronomy engine, not a flat day-count), harvest countdown, stage timeline.
3. **`/dashboard/market`** — live mandi (wholesale market) price board with a Live/Estimated badge, AI-generated sell-now-or-hold advice, transport planner, expandable mandi rows with MSP/deduction breakdowns.
4. **`/dashboard/expenses`** — income/expense ledger with charts and a transaction panel.
5. **`/dashboard/schemes`** — government scheme matcher (PM-KISAN, PMFBY, KCC, etc.), AI-ranked against the farmer's actual profile.
6. **`/dashboard/settings`** — profile/preferences, notification toggles, sign-out.
7. **`/dashboard/store-locator`** — nearby agri-input stores on a Leaflet map, sourced from OpenStreetMap.
8. **`/dashboard/disease`** — leaf-photo disease scanner with scan history.
9. **`/dashboard/assistant`** — full-page AI chat (shares state with the floating dock).

### 2.3 AI features

- **Conversational assistant** — streams replies from Groq, grounded in the farmer's real profile/farms/weather (`chatContext.ts`), scoped to agriculture topics only (a system-prompt guard refuses off-topic questions), answers in the farmer's chosen language, persists history if signed in.
- **Voice** — hands-free "listen → send → speak → listen" loop, dictation, and read-aloud, at zero marginal cost (browser Web Speech API + Groq Whisper fallback + a self-hosted MMS-TTS server for languages with no installed system voice). **English-only** by deliberate scope decision (see §6.2) — the text assistant still works in all nine languages.
- **Disease detection** — hybrid: a custom-trained CNN classifier first, Groq vision as fallback (or when the CNN server isn't running). See §6.1.
- **Crop recommendations** — during onboarding, Groq scores candidate crops for the farmer's specific area/soil/irrigation/location on suitability, confidence, risk, and expected yield/profit.
- **Market advice** — Groq turns live mandi price data into a plain-language sell/hold recommendation.
- **Scheme matching** — Groq ranks a static, hand-curated catalog of real central government schemes against the farmer's profile and returns the top 3 with reasons.
- **Crop guide** — a per-crop growing guide combining hard numbers from the agronomy engine (cycle length, stage split, yield estimate, heat threshold) with Groq-written prose — the model narrates, it does not invent the numbers.

### 2.4 Data honesty pass (2026-08-15)

Following an explicit challenge from the user about whether anything on the dashboard was real, every hardcoded/demo data series was found and removed:
- Dashboard analytics tabs (Season/Weather/Cash Flow) now render real per-farm progress, real 7-day forecasts, and real expense data — with honest empty states instead of filler when there's nothing to show.
- No price-history chart exists, because the underlying Agmarknet data source only exposes *today's* prices — a trend line would have to be invented, so it isn't drawn.
- Farm Health now renders its own explainable factor list (previously computed but silently discarded).
- Tasks became date-scoped (previously a bug let a single day's checkmark persist forever across the crop stage).

---

## 3. Architecture

### 3.1 Framework & structure

Next.js 14 (App Router), React 18, TypeScript, Tailwind CSS. No custom `next.config.mjs` beyond the default (no image domain allowlist, no redirects/rewrites configured).

```
src/
  app/               # routes: page.tsx (UI) + route.ts (API) per folder
    page.tsx, about/, team/, architecture/, oilseeds/, jaivik-sathi/
    onboarding/, login/
    dashboard/       # 9 authenticated screens + shared layout
    api/             # 9 route handlers
  components/
    dashboard/       # ~38 files — all authenticated-app UI
    landing/, auth/, i18n/, legal/, onboarding/, three/, dev/, ui/
  lib/               # ~40 files — business logic / data layer (see §3.3)
  hooks/             # useSpeechRecognition, useTextToSpeech, useVoiceConversation
ml/                  # PyTorch disease classifier + FastAPI server (optional, self-hosted)
scripts/
  sql/               # 14 numbered migrations
  *.mjs, *.py         # DB admin, crop-image fetching, India-map building
public/              # images, team photos, videos
docs/                # this report + TECHNICAL.md
```

### 3.2 Theme system

Two intentionally distinct visual languages, per the `theme-architecture` design decisions:
- **Marketing/landing pages** (`/`, `/about`, `/team`, `/jaivik-sathi`) use editorial, textured, more expressive design — the Arva pastoral aesthetic for most pages, a dark cinematic forest-green treatment for `/jaivik-sathi`, and a dark node-graph for `/architecture`.
- **The logged-in app** (onboarding, dashboard) is a single, restrained **"Redesign v2"** light theme — Warm Ivory background, Forest/Deep Green primaries, Sage tints, Mustard as an accent-only color, desaturated blue reserved for AI moments — **always light, no dark mode**. Tokens are CSS variables (`af-*` in `tailwind.config.ts`), 16px radii, hairline borders instead of lighting effects, a `font-semibold` weight ceiling, Inter as the only sans font. Chart colors are a *separate*, more saturated palette (`src/lib/chartTheme.ts`) because the brand greens fail contrast validation as thin chart marks.

### 3.3 Supabase client patterns

Three distinct entry points, all built on `@supabase/ssr` (not the legacy auth-helpers package):
- **`src/lib/supabase.ts`** — browser client, lazily constructed behind a `Proxy` so pages that are statically prerendered at build time don't fail `next build` on a machine with no env vars set.
- **`src/lib/supabase-server.ts`** (`createSupabaseServer()`) — cookie-aware server client for Server Components/route handlers; created fresh per request so RLS runs as the actual signed-in user (`auth.uid()`).
- **Service-role clients** — built ad hoc, one-off, wherever RLS needs to be bypassed (e.g. writing the public feedback form, incrementing the rate-limit counter). There is no shared "admin client" module.

Session/JWTs live entirely in Supabase-Auth-managed cookies; there is no custom session table or JWT scheme.

### 3.4 Route gating

`src/middleware.ts` matches `/dashboard/:path*`, `/onboarding`, `/login`. It refreshes the auth cookie on every matched request. Only `/dashboard/*` is actually gated (redirects signed-out users to `/login?next=...`); `/onboarding` is deliberately left ungated because it has its own in-page sign-in/sign-up step (writes are still protected by RLS regardless of whether the page itself is reachable).

---

## 4. Data model

There is **no single tracked base-schema file** — `farmer_profiles`, `farms`, `crop_cycles`, `farm_expenses` predate the migration history (created directly in the Supabase dashboard); migration `001` only fixes their grants/RLS. Everything after that is incremental.

### 4.1 Tables

| Table | Purpose | Key columns |
|---|---|---|
| `farmer_profiles` | One row per account (unique `owner_id`) | `owner_id`→`auth.users.id`, `name`, `phone`, `email` (CHECK-constrained format), `house_lat/lng/address`, `preferences` jsonb |
| `farms` | A farmer's individual farms | `farmer_id`, `farm_index`, `area`, `soil_type`, `irrigation` |
| `crop_cycles` | A crop planted on a farm | `farm_id`, `chosen_crop`, `seeding_date`, `expected_yield`, `estimated_harvest_date` |
| `farm_expenses` | Income/expense ledger | `farmer_id`, `kind` (expense/income), `category`, `amount`, `txn_date` |
| `farm_tasks` | Daily generated + checkable tasks | `farmer_id`, `task_key`, `status`, `due_date` — unique on `(farmer_id, task_key, due_date)` so completions are per-day |
| `health_snapshots` | One farm-health score per farmer per day | `farmer_id`, `snapshot_date`, `score` |
| `crop_health_records` | Disease-scan history | `farmer_id`, `crop_name`, `disease`, `confidence`, `severity`, `image_url` (a **storage path**, not a public URL) |
| `chat_messages` | AI assistant conversation history | `farmer_id`, `role`, `content` |
| `notifications` | In-app notifications | `farmer_id`, `dedupe_key` (unique per farmer), `kind`, `read` |
| `mandi_geocache` | Shared cache for mandi geocoding | `key` (PK), `lat`, `lng`, `source` — **created but currently unused by any app code**; mandi distances shown today are a synthetic placeholder |
| `feedback` | Landing-page contact form | `email`, `message`, `notified_at` — write-only from outside, no anon/authenticated read |
| `api_rate_limits` | Fixed-window request counters | `bucket_key`, `window_start`, `hits` — backs Postgres-based rate limiting (the app is stateless serverless, so in-memory limiting isn't viable) |

### 4.2 Storage

**`leaf-scans`** bucket — created *public* in migration 005, flipped to **private** in migration 014 (5 MB cap, JPEG/PNG/WebP only). Access is now via owner-scoped RLS on `storage.objects` plus short-lived signed URLs minted server-side per render.

### 4.3 RLS history — including a known tracking gap

1. `001` — MVP, fully permissive (`anon`+`authenticated` allow-all) on the four base tables, no auth yet.
2. `003` — introduces `owner_id`, drops the permissive policies, revokes `anon` entirely, replaces with owner-scoped policies (`owner_id = auth.uid()`, or an `EXISTS` walk up to it for child tables).
3. `004`–`006` — new tables (`farm_tasks`, `health_snapshots`, `crop_health_records`, `chat_messages`, `notifications`) all created owner-scoped from the start, granted to `authenticated`/`service_role` only.
4. **`007` — "TEMPORARY revert of 003"**: restores the fully permissive policies from `001` on the four base tables, because the *then-deployed* Vercel build still ran old no-auth code against the anon key and prod was reading empty. The migration's own comment says to re-apply `003` "as soon as the auth-enabled build is deployed."
5. **No later migration file (008–014) re-applies `003`.** Project memory records that `003` *was* manually re-applied directly against the live database on 2026-08-15 (verified then: anon key gets 401 on all four tables, cross-account reads return nothing) — but that fix was never captured as a new migration file. **This means the tracked SQL history, if replayed in order today, would leave `farmer_profiles`/`farms`/`crop_cycles`/`farm_expenses` open to the anon key again.** A new `015_reapply_ownership_rls.sql` should be added to close this gap so the migration history matches the actual (secured) live state. Until that exists, do not replay the migration files against a fresh project without manually skipping `007` or re-running `003` after it.
6. `008` (`mandi_geocache`) — read-only to any `authenticated` user, write via `service_role` only.
7. `011` (`feedback`), `013` (`api_rate_limits`) — deny-all by default; only reachable via `service_role`.
8. `014` — three owner-scoped storage policies for `leaf-scans`.

---

## 5. External integrations

| Integration | Env var | Used for | Cost |
|---|---|---|---|
| **Groq — text** | `GROQ_API_KEY`, `GROQ_TEXT_MODEL` (default `openai/gpt-oss-120b`) | Chat assistant, crop recommendations, crop guide, market advice, scheme matching, disease narrative | Pay-per-token |
| **Groq — vision** | `GROQ_API_KEY`, `GROQ_VISION_MODEL` (default `qwen/qwen3.6-27b`) | Disease-diagnosis fallback when the local CNN is absent or unsure | Pay-per-token |
| **Groq — Whisper** | `GROQ_API_KEY` | Speech-to-text fallback (`whisper-large-v3-turbo`) for browsers without Web Speech (mainly Firefox) | Pay-per-token |
| **data.gov.in Agmarknet** | `DATA_GOV_API_KEY` (optional) | Live cross-mandi commodity prices, 6h cache | Free (public sample key works, rate-limited) |
| **Open-Meteo** | none | 7-day weather forecast | Free, no key |
| **Overpass / Nominatim (OSM)** | none | Nearby agri-store search, address geocoding | Free, no key |
| **Resend** | `RESEND_API_KEY` (optional) | Emails the team when the landing feedback form is submitted | Free tier |
| **Self-hosted FastAPI (`ml/server.py`)** | `INFERENCE_URL` (optional) | Disease-CNN inference (`/predict`) + MMS-TTS speech synthesis (`/tts`) | ₹0 (self-hosted; needs a persistent process — does not run on Vercel) |

Government schemes are a **static, hand-curated catalog** (`src/lib/schemes.ts`) — there is no live scheme API; Groq only ranks/matches this fixed list.

---

## 6. AI/ML subsystems

### 6.1 Disease detection — hybrid CNN + Groq

- **Model:** MobileNetV3-Large, transfer-learned on the PlantVillage dataset (38 classes), trained in `ml/train.py`, reaching ~98% validation accuracy after one epoch. Runs in a self-hosted FastAPI server (`ml/server.py`, PyTorch, GPU if available).
- **Flow (`src/lib/disease.ts`, `/api/disease`):** image is magic-byte-sniffed and metadata-stripped, sent to the local CNN if `INFERENCE_URL` is configured. If confidence ≥ 0.6, Groq writes the treatment narrative from the CNN's label (numbers stay real, only the prose is generated). If confidence is low, or the CNN server is down, it falls back to Groq's vision model on the raw image directly — noticeably less precise (verified: a tomato-late-blight leaf scored "96% Late blight" via the CNN vs. an uncertain "Spinach, Uncertain" guess from vision alone).
- **Not available on Vercel** — the CNN server needs a persistent process and hundreds of MB of weights; without `INFERENCE_URL` set, the app degrades cleanly to vision-only.

### 6.2 Voice assistant — Web Speech + Groq Whisper, ₹0 running cost

- **Deliberately narrowed scope (2026-08-15):** voice is **English-only**. The text assistant remains fully multilingual; mic/voice-mode/speaker controls simply don't render outside English.
- **Deliberately narrowed scope:** the assistant answers **agriculture questions only** — a system-prompt guard redirects off-topic questions (verified against coding/cricket/small-talk/prompt-injection attempts).
- **STT:** browser Web Speech API primary (free, live interim text); Groq Whisper fallback via `/api/transcribe` for Firefox or on a network error.
- **TTS:** two-tier — device voice first (instant, offline) where installed (English/Hindi on most desktop browsers), else the self-hosted MMS-TTS server for the remaining 7 languages, which had **zero** installed desktop voices otherwise. **Licence note: the MMS-TTS models are CC-BY-NC 4.0 (non-commercial only)** — fine for a hackathon demo, but must be swapped for the Apache-2.0 `ai4bharat/indic-parler-tts` before any commercial launch.
- Untested by the building session: live microphone input end-to-end (no mic available in that environment) — the user still needs to verify the spoken loop by ear.

### 6.3 Market intelligence

- Real cross-mandi prices from data.gov.in Agmarknet, with a graceful "Estimated" fallback (clearly labeled in the UI) when no key is set or the API is unavailable.
- Deliberately **no price-history/trend chart** — the data source has no historical endpoint, so a trend line would be fabricated.
- Mandi rows expand to show MSP/FRP benchmarks and a deduction ladder to net farm-gate price, each line tagged by accuracy tier (exact govt feed / hand-maintained statutory rate / farmer-entered estimate).

---

## 7. Localization (i18n)

Nine locales: `en, hi, kn, ta, te, ml, mr, bn, pa`. English is the source of truth; missing keys in other locales fall back to English automatically. Coverage:
- **Fully translated:** dashboard chrome (sidebar, top bar, page titles, buttons), the landing page, the About page.
- **First-pass machine translation, flagged for native review:** non-English marketing copy.
- **English fallback still common:** deep app body copy not yet keyed.
- AI features (chat, market advice, scheme matching) are told the farmer's chosen language and reply in it, regardless of UI translation coverage.
- Locale persists to `localStorage` + a cookie; switchers exist in the dashboard top bar, settings, and the landing header.

---

## 8. Security posture

- **Auth:** real email+password via Supabase Auth (no OAuth). Email confirmation is intentionally OFF (no SMTP configured) — trade-off is **no password-reset flow**. Email format is validated in three independent layers (client, API, and a DB `CHECK` constraint — the only one a client can't bypass).
- **RLS:** owner-scoped on every farmer-data table (see §4.3 for the one tracked-history gap to close).
- **Rate limiting:** Postgres-backed fixed-window limiting on every AI-backed route (5–30 requests/min depending on route), keyed by farmer ID when signed in or IP otherwise; fails open if the DB is unreachable.
- **Upload validation:** leaf-scan images are magic-byte-sniffed (not just trusted by extension/MIME header) and metadata-stripped before storage; the storage bucket itself is private with a 5 MB cap and an explicit MIME allowlist.
- **Service-role key** is never exposed client-side; used only in isolated server-side calls that must bypass RLS (feedback writes, rate-limit increments).

---

## 9. Known gaps / honesty notes

Worth carrying forward into any roadmap conversation:

1. **RLS migration-history gap** (§4.3) — the fix is live but untracked in SQL; needs a `015` migration.
2. **`mandi_geocache` is unused** — the table and its migration exist, but no code reads or writes it; mandi distances in the market UI are a synthetic placeholder, not real geocoding.
3. **MMS-TTS is non-commercial-licensed** — must be swapped before any commercial launch.
4. **No password-reset flow** — a consequence of running without SMTP; acceptable for a demo, not for production.
5. **`next.config.mjs` has no image domain allowlist** — Leaflet marker icons and Supabase signed URLs aren't running through Next's `<Image>` optimizer.
6. **The Terms & Conditions page and some privacy/security settings from the collaborator's fork are not yet integrated** into this codebase.
7. **`main` is stale** — the deployed branch doesn't have auth, voice, or the v2 redesign; a real deploy requires merging `feature/v2-voice-auth` and redeploying, plus updating the Supabase project's "Confirm email" and Redirect URL settings for the production domain.

---

## 10. Tech stack

**Frontend/framework:** Next.js 14.1.0 (App Router) · React 18 · TypeScript 5 · Tailwind CSS 3

**UI/motion:** Framer Motion · Lenis (smooth scroll) · Radix UI (select) · Lucide icons · a custom `src/components/ui/` kit (Card, Button, Badge, Tabs, Tooltip, Skeleton, EmptyState, TrendDelta, CountUp, Reveal)

**3D:** three.js + `@react-three/fiber` + `@react-three/drei` + `@react-three/postprocessing` (used for the landing farm diorama)

**Data viz:** Recharts, with a single validated shared palette (`src/lib/chartTheme.ts`)

**Maps:** Leaflet + `react-leaflet`

**Backend:** Supabase (Postgres + Auth + Storage), Next.js Route Handlers, all deployed serverless (Vercel)

**AI:** Groq (LLM text + vision + Whisper) · self-hosted PyTorch (MobileNetV3 disease classifier) · self-hosted Meta MMS-TTS (FastAPI)

**Python ML side (`ml/`):** Python 3.12 venv (isolated from system Python 3.14 for PyTorch compatibility), PyTorch 2.11 + CUDA 12.8 (GPU-accelerated on supported hardware), FastAPI + Uvicorn, torchvision, transformers (for MMS-TTS)

---

## 11. Build & run instructions

### Web app

```bash
npm install
cp .env.example .env.local   # fill in Supabase + Groq values
```

**For a real demo or to judge the app, always build first — do not use `next dev` for that.** `next dev` compiles each route on first visit and this app is large enough (2,600–2,900 modules/route) that a cold route can take 5–13 seconds and reads as broken. Production mode serves every route in ~0.01–0.1s with no warm-up needed:

```bash
npx next build
npx next start
```

Use `next dev` only when actively editing with hot reload — and never run `build` and `dev` against the same `.next` directory (mixing them corrupts the manifests); `rm -rf .next` when switching modes.

### Database

```bash
# .env.admin.local needs SUPABASE_ACCESS_TOKEN + SUPABASE_PROJECT_REF
for f in scripts/sql/*.sql; do node scripts/db-exec.mjs "$f"; done
```

Apply in filename order (see the §4.3 caveat about `007`/`003` before doing this against a fresh project). In the Supabase dashboard, **Authentication → Providers → Email → turn "Confirm email" OFF** (required, no SMTP is configured).

### Disease/TTS inference server (optional, self-hosted)

```bash
cd ml
.venv/Scripts/python.exe -m uvicorn server:app --host 127.0.0.1 --port 8008
```

The app finds it on `localhost:8008` automatically in dev; set `INFERENCE_URL` elsewhere. Fully optional — everything degrades gracefully without it (disease scanning falls back to Groq vision, TTS falls back to whatever the browser has installed).

### Deployment

Standard Vercel Next.js deploy, no `vercel.json` needed. The four required env vars (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `GROQ_API_KEY`) must be set for Production and Preview. The Python ML server cannot run on Vercel (persistent process, large weights) — host it separately (Render/Railway/a VM) and point `INFERENCE_URL` at it, or leave it unset and accept the Groq-only fallback path.

---

*See also: `docs/MOBILE_APP_ROADMAP.md` for the native-app build plan that follows this report.*
