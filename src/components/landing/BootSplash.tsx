"use client";

import React, { useEffect, useState } from "react";
import { AnimatedSpan, Terminal, TypingAnimation } from "@/registry/magicui/terminal";
import { LeafMark } from "@/components/landing/SiteHeader";

/* Boot splash — an Agent Farmer OS "terminal" that plays once per session,
   then fades out to reveal the home page. */

const BOOT_MS = 5200;

export default function BootSplash({ onDone }: { onDone: () => void }) {
  const [leaving, setLeaving] = useState(false);

  const finish = () => {
    setLeaving(true);
    window.setTimeout(onDone, 550);
  };

  useEffect(() => {
    const t = window.setTimeout(finish, BOOT_MS);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      className={`fixed inset-0 z-[100] flex flex-col items-center justify-center px-6 transition-opacity duration-500 ${
        leaving ? "pointer-events-none opacity-0" : "opacity-100"
      }`}
    >
      <div className="of-canvas absolute inset-0" />
      <div className="of-dotgrid absolute inset-0 opacity-[0.5]" />

      <div className="relative flex flex-col items-center">
        <div className="mb-6 flex items-center gap-3">
          <span className="of-grad-emerald flex h-10 w-10 items-center justify-center rounded-2xl shadow-of-glow">
            <LeafMark className="h-5 w-5 text-white" />
          </span>
          <span className="font-mono text-[13px] uppercase tracking-[0.28em] text-of-ink">
            Agent Farmer OS
          </span>
        </div>

        <Terminal>
          <TypingAnimation>&gt; booting agent-farmer os...</TypingAnimation>

          <AnimatedSpan className="text-emerald-400">✔ Preflight checks passed.</AnimatedSpan>
          <AnimatedSpan className="text-emerald-400">✔ Framework verified — Next.js 14.</AnimatedSpan>
          <AnimatedSpan className="text-emerald-400">✔ Supabase connected — Auth + RLS online.</AnimatedSpan>
          <AnimatedSpan className="text-emerald-400">✔ i18n engine loaded — 9 languages.</AnimatedSpan>
          <AnimatedSpan className="text-emerald-400">✔ Groq LLM warm — llama-3.1-8b.</AnimatedSpan>
          <AnimatedSpan className="text-emerald-400">✔ Disease-vision model ready — MobileNetV3.</AnimatedSpan>
          <AnimatedSpan className="text-emerald-400">✔ Live feeds synced — weather · mandi · schemes.</AnimatedSpan>

          <AnimatedSpan className="text-blue-400">
            <span>ℹ Ready for:</span>
            <span className="pl-4">- every farmer, in their own language</span>
          </AnimatedSpan>

          <TypingAnimation className="text-white/60">Success! Agent Farmer OS is ready.</TypingAnimation>
          <TypingAnimation className="text-white/60">Welcome to the field.</TypingAnimation>
        </Terminal>

        <button
          onClick={finish}
          className="mt-6 font-mono text-[11px] uppercase tracking-[0.16em] text-of-muted transition-colors hover:text-of-primary"
        >
          skip →
        </button>
      </div>
    </div>
  );
}
