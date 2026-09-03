"use client";

import { useEffect, useState } from "react";
import AgentFarmerMark from "./AgentFarmerMark";
import FieldHorizon from "./FieldHorizon";
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
 * ── Why the bar never reaches 100% ───────────────────────────────────────────
 * Nothing here can know how far a server render has got. The bar eases toward
 * ~95% and stops; completion is shown by the loader disappearing and the page
 * arriving. A bar parked at 100% while someone is still waiting is the detail
 * that makes a loading screen feel like a lie.
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

export default function LoadingScreen({
  variant = "inline",
}: {
  /** "full" takes the viewport and shows the field band; "inline" sits in the content area. */
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
          ? "af-loading af-loading-full fixed inset-0 z-[300] flex flex-col items-center justify-center bg-af-bg overflow-hidden"
          : "af-loading flex flex-col items-center justify-center min-h-[62vh] w-full"
      }
    >
      <div className="flex flex-col items-center">
        <AgentFarmerMark className={full ? "w-[132px] h-auto" : "w-[92px] h-auto"} />

        {/* The wordmark. `font-reckless` is the serif already in the Tailwind
            config — the reference's serif, at no extra font request. */}
        <div
          className={`af-wordmark font-reckless text-af-ink tracking-[-0.01em] ${
            full ? "text-[34px] mt-5" : "text-[24px] mt-4"
          }`}
        >
          Agent Farmer
        </div>
        <div className="af-underline mt-1.5 h-px bg-af-amber" />

        {/* Flanking dots, as in the reference. */}
        <div className={`flex items-center gap-2.5 ${full ? "mt-6" : "mt-5"}`}>
          <span className="af-dot w-1 h-1 rounded-full bg-af-amber" />
          <span className="font-reckless text-[14px] text-af-amber-ink">{word}…</span>
          <span className="af-dot w-1 h-1 rounded-full bg-af-amber" />
        </div>

        {/* Progress. `aria-hidden` because the label above already announces
            the state, and a number that never reaches 100 would be noise read
            aloud on repeat. */}
        <div
          aria-hidden="true"
          className={`af-bar mt-4 h-1.5 rounded-full bg-af-border/70 overflow-hidden ${
            full ? "w-[240px]" : "w-[190px]"
          }`}
        >
          <div className="af-bar-fill h-full rounded-full bg-af-amber" />
        </div>
      </div>

      {/* A quiet strip, not a scene. Tall enough to read as a landscape, short
          enough that it never crowds the wordmark and progress above it. */}
      {full && (
        <div className="af-horizon-wrap absolute inset-x-0 bottom-0 pointer-events-none">
          <FieldHorizon className="w-full h-[17vh] max-h-[150px]" />
        </div>
      )}
    </div>
  );
}
