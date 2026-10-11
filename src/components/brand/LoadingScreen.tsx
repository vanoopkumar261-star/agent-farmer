"use client";

import { useEffect, useState } from "react";
import { ThinkingOrb } from "thinking-orbs";
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
 * The visual is `thinking-orbs`' `ThinkingOrb` (`state="working"`), which loops
 * for as long as this stays mounted — no progress fraction to fake, so nothing
 * here can sit frozen at 100% while a fetch is still running underneath it.
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
        <ThinkingOrb state="working" size={64} theme="auto" />

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
