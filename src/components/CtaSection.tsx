"use client";

import { ArrowRight, Sparkles, ShieldCheck } from "lucide-react";
import { motion } from "framer-motion";

type Props = {
  onGetStarted: () => void;
};

export default function CtaSection({ onGetStarted }: Props) {
  return (
    <section className="relative overflow-hidden bg-hud-bg py-24 px-6">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            "radial-gradient(900px circle at 20% 30%, rgba(57,255,176,0.08), transparent 60%), radial-gradient(800px circle at 80% 20%, rgba(76,158,255,0.07), transparent 62%)",
        }}
      />

      <div className="relative z-10 max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-10%" }}
          transition={{ duration: 0.6 }}
          className="relative overflow-hidden rounded-[32px] bg-hud-panel backdrop-blur-xl border border-hud-border shadow-[0_18px_60px_rgba(0,0,0,0.45)]"
        >
          <div className="pointer-events-none absolute -top-24 -left-24 h-72 w-72 rounded-full bg-hud-green/10 blur-[50px]" />
          <div className="pointer-events-none absolute -bottom-28 -right-28 h-80 w-80 rounded-full bg-hud-blue/10 blur-[54px]" />

          <div className="relative z-10 px-8 py-14 md:px-14 md:py-16">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 rounded-full bg-white/[0.03] backdrop-blur border border-hud-border px-4 py-2">
                <Sparkles className="w-4 h-4 text-hud-blue" />
                <span className="font-mono text-[10px] font-bold tracking-[0.22em] text-hud-blue uppercase">
                  ready_to_deploy --farm-os
                </span>
              </div>

              <h3 className="mt-6 font-sans text-3xl md:text-5xl font-extrabold tracking-tight text-hud-text leading-[1.05]">
                Start your season with
                <span className="text-hud-green"> AI guidance</span>.
              </h3>

              <p className="mt-5 font-sans text-base md:text-lg text-hud-text-dim leading-relaxed">
                Register your fields, get crop recommendations, track weekly forecasts, and manage your entire farming lifecycle in one place.
              </p>

              <div className="mt-9 flex flex-col sm:flex-row gap-4">
                <button
                  onClick={onGetStarted}
                  className="inline-flex items-center justify-center gap-2 rounded-[14px] bg-hud-green hover:bg-hud-green/85 text-hud-bg px-7 py-3.5 text-sm font-bold transition active:scale-[0.98] shadow-hud-glow-green"
                >
                  Get Started <ArrowRight className="w-4 h-4" />
                </button>

                <button
                  onClick={() => alert("Demo placeholder (we can link a video later).")}
                  className="inline-flex items-center justify-center gap-2 rounded-[14px] bg-white/[0.03] hover:bg-white/[0.06] backdrop-blur border border-hud-border text-hud-text px-7 py-3.5 text-sm font-bold transition active:scale-[0.98]"
                >
                  <ShieldCheck className="w-4 h-4 text-hud-green" />
                  See Demo Flow
                </button>
              </div>

              <div className="mt-10 flex flex-wrap items-center gap-3 text-hud-text-faint">
                <span className="font-mono text-[10px] font-bold tracking-[0.22em] uppercase">
                  0-cost demo stack
                </span>
                <span className="h-1 w-1 rounded-full bg-hud-text-faint" />
                <span className="text-sm text-hud-text-dim">Fast onboarding</span>
                <span className="h-1 w-1 rounded-full bg-hud-text-faint" />
                <span className="text-sm text-hud-text-dim">Multi-farm support</span>
                <span className="h-1 w-1 rounded-full bg-hud-text-faint" />
                <span className="text-sm text-hud-text-dim">AI assistant ready</span>
              </div>
            </div>
          </div>
        </motion.div>

        <div className="h-8" />
      </div>
    </section>
  );
}
