# Agent Farmer 🌱

**An autonomous farming OS** — an AI companion for every farmer that spots disease, answers questions, and turns field data into decisions, in **nine Indian languages**. Includes **Jaivik Sathi** (*जैविक साथी*, "A Companion of the Soil"), the "Future Us" concept for a solar-powered, sensor-instrumented on-farm bio-input production unit.

> MSME Idea Hackathon 6.0 · Industry 4.0 & 5.0 · Agriculture & Allied Industries

---

## ✨ What's inside

- **Landing site** — editorial marketing pages (home, about, team, architecture) with a layered, textured design system.
- **Jaivik Sathi** (`/jaivik-sathi`) — a cinematic, forest-green concept page (floating rock imagery, Lenis smooth scroll, scroll parallax, live charts) presenting the bio-input unit.
- **Dashboard** (`/dashboard`) — the farmer app: crops, AI assistant, disease scanner, market prices, government schemes, expenses, store locator.
- **AI features** — LLM assistant, crop-disease advisory, market/scheme matching (Groq), plus an optional hybrid-CNN image scanner (PyTorch).
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

Admin-only DB migration tokens (`SUPABASE_ACCESS_TOKEN`, `SUPABASE_PROJECT_REF`) go in `.env.admin.local`.

Every optional variable degrades honestly rather than breaking: no `DATA_GOV_API_KEY` means prices are shown as estimates, no `RESEND_API_KEY` means feedback is still stored and the confirmation says so instead of claiming you were notified, and no `INFERENCE_URL` means the disease scanner uses the Groq vision model alone.

## 🗄️ Database setup

The schema is a numbered set of SQL migrations in `scripts/sql/`, applied in order against a fresh Supabase project:

```bash
# Put SUPABASE_ACCESS_TOKEN + SUPABASE_PROJECT_REF in .env.admin.local first
for f in scripts/sql/*.sql; do node scripts/db-exec.mjs "$f"; done
```

They create the farmer/farm/crop tables with per-owner row-level security, the task and notification tables, the mandi geocache, and the feedback table. Later migrations assume the earlier ones have run, so apply them in filename order.

**One Supabase setting matters:** under **Authentication → Providers → Email**, turn **"Confirm email" OFF**. The app has no SMTP configured, so with confirmation on, `signUp` returns no session and registration appears to hang. When you deploy, also add your production URL under **Authentication → URL Configuration → Redirect URLs**.

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
