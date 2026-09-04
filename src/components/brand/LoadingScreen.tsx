"use client";

import { useEffect, useState } from "react";
import AgentFarmerMark from "./AgentFarmerMark";
import { STORAGE_KEY } from "@/lib/i18n/config";

/**
 * What a farmer looks at while a slow page is being built.
 *
 * `/dashboard` awaits profile, weather, expenses, mandi prices and task
 * recording in sequence, and `/dashboard/market` adds a mandi fetch per crop on
 * top. On a cold cache that is several seconds of nothing at all, which is the
 * point at which people tap again or leave.
 *
 * ── Why it waits before appearing ────────────────────────────────────────────
 * Next renders a `loading.tsx` the instant navigation starts, so showing it
 * immediately would flash a splash screen on every quick click and make a fast
 * app feel heavy. This mounts at `opacity: 0` and fades in only after ~400ms —
 * a CSS delay, not a timer, so there is nothing to leak or cancel and a page
 * that resolves in 200ms unmounts it before it was ever painted.
 *
 * ── Why the arcs never close ─────────────────────────────────────────────────
 * Nothing here can know how far a server render has got. The plant grows to
 * full — a plant is not a percentage, and one frozen half-grown reads as broken
 * rather than as honest — but the two arcs sweeping it stop about 14% short and
 * stay open for as long as the wait lasts. Completion is shown by the loader
 * disappearing and the page arriving. An indicator sitting at 100% while
 * someone is still waiting is the detail that makes a loading screen feel like
 * a lie.
 */

/**
 * "Loading" in the nine languages the app speaks.
 *
 * Deliberately not `useT()`. The root `loading.tsx` renders ABOVE the dashboard
 * layout, so it is outside `LanguageProvider` and `t()` there returns the key
 * silently — a failure this codebase has hit before. Reading the locale the
 * provider persists is the one thing that works in both placements.
 */
const LOADING_WORD: Record<string, string> = {
  en: "Loading",
  hi: "लोड हो रहा है",
  kn: "ಲೋಡ್ ಆಗುತ್ತಿದೆ",
  ta: "ஏற்றுகிறது",
  te: "లోడ్ అవుతోంది",
  ml: "ലോഡുചെയ്യുന്നു",
  mr: "लोड होत आहे",
  bn: "লোড হচ্ছে",
  pa: "ਲੋਡ ਹੋ ਰਿਹਾ ਹੈ",
};

/** Rendered width of the mark on the full-bleed splash, in px. The soil-line
 *  offset is derived from it, so the two cannot drift apart. */
const MARK_W = 200;

export default function LoadingScreen({
  variant = "inline",
}: {
  /** "full" takes the viewport; "inline" sits in the dashboard content area. */
  variant?: "full" | "inline";
}) {
  // Starts English and corrects on mount. The server cannot know the locale —
  // it lives in this browser's storage — and guessing would flash the wrong
  // script at someone who does not read English.
  const [word, setWord] = useState(LOADING_WORD.en);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored && LOADING_WORD[stored]) setWord(LOADING_WORD[stored]);
    } catch {
      /* storage unavailable — English is a fine fallback */
    }
  }, []);

  const full = variant === "full";

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={`${word}…`}
      className={
        full
          ? "af-loading fixed inset-0 z-[300] flex flex-col items-center justify-center bg-af-bg overflow-hidden"
          : "af-loading flex flex-col items-center justify-center min-h-[62vh] w-full"
      }
    >
      <div className="relative flex flex-col items-center">
        {/* The mark's own soil line, continued to the screen edges, so the plant
            grows out of the page rather than out of a small illustration. Only
            on the full-bleed splash; inline it would draw a rule across the
            dashboard content area.

            The offset is derived, not eyeballed. The mark is a 120×200 viewBox
            at `h-auto`, so its rendered height is width × 200/120, and the soil
            sits at y=162 of 200 — which lands at width × (200/120) × (162/200),
            i.e. width × 1.35. Hard-coding 200px here was wrong by 60px because
            it treated the box as square. */}
        {full && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute left-1/2 -translate-x-1/2 h-px w-[min(78vw,720px)]
                       bg-[linear-gradient(90deg,transparent,rgb(var(--af-ink)/0.28),transparent)]"
            style={{ top: `${MARK_W * 1.35}px` }}
          />
        )}

        <AgentFarmerMark
          className="h-auto"
          style={{ width: full ? MARK_W : 132 }}
        />

        {/* The wordmark. `font-reckless` is the serif already in the Tailwind
            config — the reference's serif, at no extra font request. */}
        <div
          className={`af-wordmark font-reckless text-af-ink tracking-[-0.01em] ${
            full ? "text-[34px] mt-6" : "text-[24px] mt-4"
          }`}
        >
          Agent Farmer
        </div>

        {/* A hairline needs weight it cannot get from area: --af-leaf at 1px on
            ivory all but disappears, so this takes the darker --af-primary. */}
        <div className="af-underline mt-1.5 h-px bg-af-primary" />

        {/* --af-ink-2 (7.6:1 on --af-bg), not the obvious --af-leaf (3.8:1) or
            --af-muted (3.4:1), both of which fail AA at this size. The mustard
            it replaces was documented as 5.1:1 — true on white, but 4.4:1 on
            the ivory this actually sits on, so it was already failing. */}
        <div className={`font-reckless text-[14px] text-af-ink-2 ${full ? "mt-4" : "mt-3"}`}>
          {word}…
        </div>
      </div>
    </div>
  );
}
