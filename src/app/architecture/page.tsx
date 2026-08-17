"use client";

import React, { useEffect, useRef, useState } from "react";
import { LanguageProvider } from "@/components/i18n/LanguageProvider";
import SiteHeader from "@/components/landing/SiteHeader";

/* ────────────────────────────────────────────────────────────────────────────
   Agent Farmer — Architecture page
   Dark node-graph canvas + brand-green glow. A scroll-driven 3D "dolly" travels
   layer by layer through the REAL stack (mapped from the codebase). The camera
   moves via a single rAF loop that writes transforms directly to plane refs —
   no per-frame React state — so it stays smooth. Per-layer node/edge reveals are
   CSS (see globals.css .arch-*). Click any node for its real details.
   ──────────────────────────────────────────────────────────────────────────── */

type Node = {
  id: string;
  title: string;
  sub: string;
  detail: string;
  x: number; // in a 1000 × 600 virtual canvas
  y: number;
};
type Edge = [string, string];
type Layer = {
  kind: "intro" | "graph";
  index: string;
  name: string;
  blurb?: string;
  nodes?: Node[];
  edges?: Edge[];
};

const LAYERS: Layer[] = [
  {
    kind: "intro",
    index: "00",
    name: "The Build",
    blurb:
      "Agent Farmer, from its core outward — every real layer of the system and how data flows between them. Scroll to travel the stack.",
  },
  {
    kind: "graph",
    index: "01",
    name: "Client",
    blurb: "What runs in the farmer's browser.",
    nodes: [
      { id: "ui", title: "Next.js App Router", sub: "React 18 · TypeScript", x: 500, y: 120, detail: "The UI is a Next.js 14 App Router tree of React Server + Client Components. Routes: landing, /team, /architecture, /onboarding and the /dashboard suite (crops, assistant, disease, market, store-locator, expenses, schemes, settings)." },
      { id: "theme", title: "Tailwind CSS", sub: "Arva + Apple-Health themes", x: 190, y: 350, detail: "Two token systems in tailwind.config.ts: the light 'Arva' pastoral-editorial theme for public pages, and the light 'Apple-Health' premium theme (af-* tokens) for the logged-in app. No dark mode in the app." },
      { id: "i18n", title: "i18n — 9 languages", sub: "useT · dictionaries", x: 500, y: 440, detail: "A LanguageProvider exposes useT() → { locale, setLocale, t }. Dictionaries cover English + 8 Indian languages (hi, kn, ta, te, ml, mr, bn, pa) with English fallback; choice persists to localStorage + cookie." },
      { id: "viz", title: "Recharts · Leaflet · R3F", sub: "charts · maps · 3D", x: 810, y: 350, detail: "Data-viz via Recharts, interactive maps via React-Leaflet, and 3D via React Three Fiber + drei + postprocessing." },
    ],
    edges: [["ui", "theme"], ["ui", "i18n"], ["ui", "viz"]],
  },
  {
    kind: "graph",
    index: "02",
    name: "Application",
    blurb: "The Next.js server runtime.",
    nodes: [
      { id: "rsc", title: "Server Components", sub: "+ React cache()", x: 260, y: 150, detail: "Pages fetch on the server. getDashboardData is wrapped in React cache() to dedupe the layout+page double-fetch — warm dashboard load dropped ~3s → ~0.4s." },
      { id: "api", title: "Route Handlers /api/*", sub: "chat · disease · recs · market · schemes", x: 660, y: 300, detail: "Five API route handlers: /api/chat, /api/disease, /api/recommendations, /api/market-advice, /api/scheme-match. Each is force-dynamic; the disease route allows up to 60s." },
      { id: "libs", title: "server-only libs", sub: "disease · gemini · dashboard", x: 300, y: 440, detail: "'server-only' modules in src/lib hold the secret-touching logic (Groq calls, Supabase queries, provider orchestration) so keys never reach the client bundle." },
    ],
    edges: [["rsc", "api"], ["api", "libs"], ["rsc", "libs"]],
  },
  {
    kind: "graph",
    index: "03",
    name: "Data",
    blurb: "Supabase — the source of truth.",
    nodes: [
      { id: "pg", title: "Postgres", sub: "profiles · farms · crop_cycles · expenses", x: 500, y: 140, detail: "Supabase Postgres holds farmer_profiles, farms, crop_cycles, expenses and more. Foreign keys let a single nested select fan out the whole graph." },
      { id: "auth", title: "Auth + Row-Level Security", sub: "per-farmer isolation", x: 230, y: 360, detail: "Supabase Auth plus Postgres Row-Level Security — every row is scoped to its owner, so a farmer only ever reads their own data." },
      { id: "query", title: "1 nested query", sub: "cached · warm load ~0.4s", x: 780, y: 360, detail: "farmer_profiles select *, farms(*, crop_cycles(*)) — one round-trip instead of three serial ones, wrapped in cache()." },
      { id: "admin", title: "scripts/db-exec.mjs", sub: "admin SQL runner", x: 500, y: 480, detail: "A Node script runs migrations / admin SQL against Supabase using the service-role key, out-of-band from the app." },
    ],
    edges: [["pg", "auth"], ["pg", "query"], ["pg", "admin"]],
  },
  {
    kind: "graph",
    index: "04",
    name: "AI & ML",
    blurb: "Where the intelligence lives.",
    nodes: [
      { id: "groq", title: "Groq LLM", sub: "gpt-oss-120b · chat, recs, schemes, market", x: 290, y: 140, detail: "Groq's gpt-oss-120b powers the assistant chat, crop recommendations, scheme matching and market advice — and writes the treatment plan once a disease is named. Replies come back in the user's chosen language." },
      { id: "vision", title: "Groq Vision", sub: "qwen3.6-27b · fallback dx", x: 720, y: 150, detail: "When the trained classifier is unsure or the crop is out-of-distribution, qwen3.6-27b vision diagnoses directly from the leaf photo instead of guessing. It is a safety net, not a replacement — the trained CNN is markedly more precise on the crops it knows." },
      { id: "cnn", title: "FastAPI + MobileNetV3", sub: "PyTorch · PlantVillage · :8008", x: 300, y: 420, detail: "A local FastAPI server (ml/server.py, port 8008) serves a MobileNetV3-Large fine-tuned on PlantVillage. /predict returns the top-3 classes with confidence." },
      { id: "hybrid", title: "Hybrid router", sub: "model ≥ 0.6 → narrative · else vision", x: 720, y: 420, detail: "The /api/disease handler tries the CNN first; if confidence ≥ 0.6 it enriches the label with a Groq narrative, otherwise it falls back to Groq vision — best of speed and coverage." },
    ],
    edges: [["hybrid", "cnn"], ["hybrid", "groq"], ["hybrid", "vision"], ["cnn", "groq"]],
  },
  {
    kind: "graph",
    index: "05",
    name: "External & Infra",
    blurb: "The world the app plugs into.",
    nodes: [
      { id: "weather", title: "Open-Meteo", sub: "weather forecast", x: 200, y: 150, detail: "Live weather + forecast from the free Open-Meteo API, keyed to each farm's coordinates." },
      { id: "mandi", title: "data.gov.in", sub: "mandi prices", x: 500, y: 120, detail: "Government open-data mandi price feeds power the Market Intelligence screen." },
      { id: "osm", title: "Overpass / OSM", sub: "store locator", x: 800, y: 150, detail: "The store locator queries the Overpass API over OpenStreetMap to find nearby agri-input shops." },
      { id: "schemes", title: "Gov scheme portals", sub: "PM-KISAN · PMFBY · eNAM", x: 300, y: 410, detail: "Curated deep-links to official schemes (PM-KISAN, PMFBY, eNAM, PMKSY, Soil Health Card, and more), matched to the farmer by the LLM." },
      { id: "infra", title: "Next.js runtime", sub: "Vercel-ready · .env secrets", x: 700, y: 410, detail: "The app runs on the Next.js Node runtime (Vercel-ready). Secrets (GROQ_API_KEY, Supabase keys, INFERENCE_URL) live in environment variables, never in the client." },
    ],
    edges: [["infra", "weather"], ["infra", "mandi"], ["infra", "osm"], ["infra", "schemes"]],
  },
];

const M = LAYERS.length;
const PERSP = 1100;
const DEPTH = 1800;
const FOCUS = 0.16; // half-width (in progress units) of the in-focus band

function GraphPlane({ layer, onPick }: { layer: Layer; onPick: (n: Node) => void }) {
  const byId = (id: string) => layer.nodes!.find((n) => n.id === id)!;
  return (
    <div className="relative h-[min(600px,72vh)] w-[min(1040px,94vw)]">
      {/* layer caption */}
      <div className="pointer-events-none absolute -top-14 left-0 flex items-baseline gap-3">
        <span className="font-mono text-[13px] text-[#39ffb0]">{layer.index}</span>
        <span className="font-inter text-[22px] font-medium tracking-tight text-white">{layer.name}</span>
        <span className="font-inter text-[13px] font-light text-white/45">{layer.blurb}</span>
      </div>

      {/* connectors */}
      <svg
        viewBox="0 0 1000 600"
        preserveAspectRatio="none"
        className="absolute inset-0 h-full w-full overflow-visible"
        aria-hidden
      >
        <defs>
          <linearGradient id="arch-green" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#1e8f6b" />
            <stop offset="0.5" stopColor="#39ffb0" />
            <stop offset="1" stopColor="#e8fe85" />
          </linearGradient>
        </defs>
        {layer.edges!.map(([a, b], i) => {
          const na = byId(a);
          const nb = byId(b);
          const dx = (nb.x - na.x) * 0.5;
          const d = `M ${na.x} ${na.y} C ${na.x + dx} ${na.y}, ${nb.x - dx} ${nb.y}, ${nb.x} ${nb.y}`;
          return (
            <path
              key={i}
              className="arch-edge"
              d={d}
              pathLength={1}
              fill="none"
              stroke="url(#arch-green)"
              strokeWidth={2}
              strokeLinecap="round"
              style={{ filter: "drop-shadow(0 0 5px rgba(57,255,176,0.55))", animationDelay: `${0.15 + i * 0.1}s` }}
            />
          );
        })}
      </svg>

      {/* nodes */}
      {layer.nodes!.map((n, i) => (
        <button
          key={n.id}
          onClick={() => onPick(n)}
          className="arch-node group absolute w-[210px] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-white/10 bg-[#0a1310]/80 p-4 text-left backdrop-blur-md transition-colors hover:border-[#39ffb0]/60"
          style={{ left: `${n.x / 10}%`, top: `${n.y / 6}%`, animationDelay: `${i * 0.08}s` }}
        >
          <span className="arch-lock-glow" aria-hidden />
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-[#39ffb0] shadow-[0_0_8px_rgba(57,255,176,0.9)]" />
            <span className="font-inter text-[14px] font-semibold text-white">{n.title}</span>
          </div>
          <p className="mt-1.5 font-inter text-[12px] font-light leading-snug text-white/50">{n.sub}</p>
          <span className="mt-2 inline-block font-mono text-[10px] uppercase tracking-widest text-[#39ffb0]/0 transition-colors group-hover:text-[#39ffb0]/80">
            details →
          </span>
        </button>
      ))}
    </div>
  );
}

function IntroPlane({ layer }: { layer: Layer }) {
  return (
    <div className="max-w-[720px] px-6 text-center">
      <span className="font-mono text-[13px] tracking-widest text-[#39ffb0]">{layer.index} · ARCHITECTURE</span>
      <h1 className="mt-5 font-inter text-[44px] font-semibold leading-[1.05] tracking-tight text-white sm:text-[64px]">
        How Agent Farmer<br />is built
      </h1>
      <p className="mx-auto mt-6 max-w-[52ch] font-inter text-[16px] font-light leading-[1.7] text-white/60">
        {layer.blurb}
      </p>
      <div className="mt-10 flex flex-col items-center gap-2 font-inter text-[13px] text-white/50">
        Scroll to travel the stack
        <svg viewBox="0 0 24 24" className="h-5 w-5 animate-af-float" fill="none" aria-hidden>
          <path d="M12 5v14M6 13l6 6 6-6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    </div>
  );
}

function ArchitectureContent() {
  const trackRef = useRef<HTMLDivElement>(null);
  const planeRefs = useRef<(HTMLDivElement | null)[]>([]);
  const glowRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef(0);
  const lockedRef = useRef(false);
  const [active, setActive] = useState(0);
  const [locked, setLocked] = useState(false);
  const [selected, setSelected] = useState<Node | null>(null);

  // Gentle scroll-snap so the page can rest exactly on each layer's focus point.
  useEffect(() => {
    const html = document.documentElement;
    const prev = html.style.scrollSnapType;
    html.style.scrollSnapType = "y proximity";
    return () => {
      html.style.scrollSnapType = prev;
    };
  }, []);

  useEffect(() => {
    let raf = 0;
    const update = () => {
      raf = 0;
      const track = trackRef.current;
      if (!track) return;
      const total = track.offsetHeight - window.innerHeight;
      const scrolled = Math.min(Math.max(-track.getBoundingClientRect().top, 0), total);
      const p = total > 0 ? scrolled / total : 0;

      for (let i = 0; i < M; i++) {
        const el = planeRefs.current[i];
        if (!el) continue;
        const f = M > 1 ? i / (M - 1) : 0;
        const d = p - f; // <0 upcoming, 0 focus, >0 passed
        const z = d * DEPTH;
        const dist = Math.abs(d);
        const opacity = Math.max(0, 1 - dist / FOCUS);
        const blur = Math.min(dist / FOCUS, 1) * 6;
        el.style.transform = `translate(-50%, -50%) translateZ(${z.toFixed(1)}px)`;
        el.style.opacity = opacity.toFixed(3);
        el.style.filter = blur > 0.05 ? `blur(${blur.toFixed(1)}px)` : "none";
        el.style.pointerEvents = dist < 0.06 ? "auto" : "none";
        el.style.zIndex = String(100 - Math.round(dist * 100));
      }
      if (glowRef.current) {
        glowRef.current.style.transform = `translateY(${(p * -160).toFixed(1)}px)`;
      }
      const next = Math.max(0, Math.min(M - 1, Math.round(p * (M - 1))));
      if (next !== activeRef.current) {
        activeRef.current = next;
        setActive(next);
      }
      // "Locked" = the active layer is centred enough to be cleanly clickable.
      const fNext = M > 1 ? next / (M - 1) : 0;
      const nowLocked = Math.abs(p - fNext) < 0.05;
      if (nowLocked !== lockedRef.current) {
        lockedRef.current = nowLocked;
        setLocked(nowLocked);
      }
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    update();
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  const goToLayer = (i: number) => {
    const track = trackRef.current;
    if (!track) return;
    const total = track.offsetHeight - window.innerHeight;
    const f = M > 1 ? i / (M - 1) : 0;
    window.scrollTo({ top: track.offsetTop + f * total, behavior: "smooth" });
  };

  return (
    <div className="relative min-h-screen w-full overflow-x-clip bg-[#050806] font-inter text-white">
      <SiteHeader />

      {/* fixed atmosphere: dot grid + green glows + vignette */}
      <div className="pointer-events-none fixed inset-0 z-0" aria-hidden>
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: "radial-gradient(rgba(255,255,255,0.10) 1px, transparent 1px)",
            backgroundSize: "26px 26px",
            maskImage: "radial-gradient(ellipse 90% 70% at 50% 45%, #000 55%, transparent 100%)",
            WebkitMaskImage: "radial-gradient(ellipse 90% 70% at 50% 45%, #000 55%, transparent 100%)",
          }}
        />
        <div ref={glowRef} className="absolute inset-0">
          <div className="absolute left-[12%] top-[22%] h-[380px] w-[380px] rounded-full bg-[#10b981]/20 blur-[120px]" />
          <div className="absolute right-[10%] top-[55%] h-[420px] w-[420px] rounded-full bg-[#39ffb0]/12 blur-[130px]" />
        </div>
      </div>

      {/* left layer index */}
      <nav className="fixed left-6 top-1/2 z-20 hidden -translate-y-1/2 flex-col gap-3 lg:flex" aria-label="Architecture layers">
        {LAYERS.map((l, i) => {
          const isActive = active === i;
          const isLock = isActive && locked;
          return (
            <button
              key={l.index}
              onClick={() => goToLayer(i)}
              className="group flex items-center gap-3 text-left"
            >
              <span
                className={`h-px transition-all duration-300 ${
                  isLock
                    ? "w-10 bg-[#39ffb0] shadow-[0_0_10px_rgba(57,255,176,0.9)]"
                    : isActive
                      ? "w-8 bg-[#39ffb0]"
                      : "w-4 bg-white/25 group-hover:bg-white/50"
                }`}
              />
              <span
                className={`font-mono text-[11px] tracking-widest transition-all ${
                  isActive ? "text-[#39ffb0]" : "text-white/40 group-hover:text-white/70"
                } ${isLock ? "drop-shadow-[0_0_6px_rgba(57,255,176,0.7)]" : ""}`}
              >
                {l.index} {l.name.toUpperCase()}
              </span>
            </button>
          );
        })}
      </nav>

      {/* scroll track with sticky 3D stage */}
      <div ref={trackRef} className="relative z-10" style={{ height: `${M * 100}vh` }}>
        {/* invisible snap anchors — one per layer's focus point */}
        <div className="pointer-events-none absolute inset-x-0 top-0" aria-hidden>
          {LAYERS.map((_, i) => (
            <div
              key={i}
              className="absolute left-0 right-0 h-screen"
              style={{ top: `${i * 100}vh`, scrollSnapAlign: "start" }}
            />
          ))}
        </div>
        <div
          className="sticky top-0 flex h-screen items-center justify-center overflow-hidden"
          style={{ perspective: `${PERSP}px` }}
        >
          {LAYERS.map((layer, i) => (
            <div
              key={layer.index}
              ref={(el) => {
                planeRefs.current[i] = el;
              }}
              className={`arch-plane absolute left-1/2 top-1/2 flex items-center justify-center ${
                active === i ? "is-active" : ""
              } ${active === i && locked ? "is-locked" : ""}`}
              style={{ willChange: "transform, opacity, filter" }}
            >
              {layer.kind === "intro" ? (
                <IntroPlane layer={layer} />
              ) : (
                <GraphPlane layer={layer} onPick={setSelected} />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* focus beacon — glows when the current layer is locked/clickable */}
      <div
        className={`fixed bottom-7 left-1/2 z-20 -translate-x-1/2 transition-opacity duration-300 ${
          active === 0 ? "pointer-events-none opacity-0" : "opacity-100"
        }`}
      >
        <div
          className={`flex items-center gap-2.5 rounded-full border px-4 py-2 font-inter text-[12px] backdrop-blur-md transition-all duration-300 ${
            locked
              ? "border-[#39ffb0]/60 bg-[#39ffb0]/10 text-[#39ffb0] shadow-[0_0_22px_rgba(57,255,176,0.28)]"
              : "border-white/10 bg-black/30 text-white/45"
          }`}
        >
          <span
            className={`h-2 w-2 rounded-full transition-all ${
              locked ? "animate-pulse bg-[#39ffb0] shadow-[0_0_10px_rgba(57,255,176,0.95)]" : "bg-white/30"
            }`}
          />
          {locked ? "Cards in focus — click any node" : "Keep scrolling to lock the next layer"}
        </div>
      </div>

      {/* node detail modal */}
      {selected && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center p-6"
          onClick={() => setSelected(null)}
        >
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div
            className="relative z-10 w-full max-w-[440px] rounded-2xl border border-[#39ffb0]/25 bg-[#0a1310]/95 p-7"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-[#39ffb0] shadow-[0_0_10px_rgba(57,255,176,0.9)]" />
              <h3 className="font-inter text-[20px] font-semibold text-white">{selected.title}</h3>
            </div>
            <p className="mt-1 font-mono text-[12px] uppercase tracking-widest text-[#39ffb0]/80">{selected.sub}</p>
            <p className="mt-4 font-inter text-[14px] font-light leading-[1.7] text-white/70">{selected.detail}</p>
            <button
              onClick={() => setSelected(null)}
              className="mt-6 rounded-full border border-white/15 px-4 py-2 font-inter text-[13px] text-white/70 transition-colors hover:border-[#39ffb0]/60 hover:text-white"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ArchitecturePage() {
  return (
    <LanguageProvider>
      <ArchitectureContent />
    </LanguageProvider>
  );
}
