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

All config lives in `.env.local` (gitignored). See **[`.env.example`](./.env.example)** for the full list — the essentials:

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase project + public key |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only DB access (keep secret) |
| `GROQ_API_KEY` | LLM assistant & advisory |
| `INFERENCE_URL` | Optional — disease-detection inference server |

Admin-only DB migration tokens (`SUPABASE_ACCESS_TOKEN`, `SUPABASE_PROJECT_REF`) go in `.env.admin.local`.

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
scripts/             # DB migration helper (db-exec.mjs) + SQL
```

## 🧠 Disease-detection ML server (optional)

The image-based crop-disease scanner uses a hybrid CNN served from `ml/` (FastAPI). Point `INFERENCE_URL` at it. See the `ml/` folder for the model (`train.py`) and server (`server.py`).

## 👥 Team

**Anoopkumar V** — Team Lead · LLM Developer & 3-D Designer · **Barsha Sharma** — Content Researcher & Tester · **Sahajtha Singh** — UI Designer & Curator · **Shiven Chopra** — i18n Architect & Designer · **Manan Agrawal** — Database Manager & Backend Developer

## 🙏 Credits

- Jaivik Sathi hero 3D rock model: [Poly Haven](https://polyhaven.com) (CC0).
- Nature/product imagery: AI-generated for this project.

---

*Private project — MSME Idea Hackathon 6.0.*
