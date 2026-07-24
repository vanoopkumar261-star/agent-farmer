"use client";

import React from "react";
import dynamic from "next/dynamic";
import { ArrowRight, Play } from "lucide-react";
import TerminalWindow from "./dev/TerminalWindow";
import TypewriterJson from "./dev/TypewriterJson";

const FarmDiorama = dynamic(() => import("./three/FarmDiorama"), { ssr: false });

type HeroProps = {
  onGetStarted: () => void;
};

const SAMPLE_JSON = JSON.stringify(
  {
    farm_id: "fld_09c2",
    location: "Hubballi, KA",
    ai_engine: "agent-farmer/crop-v2",
    recommendations: [
      { crop: "Wheat", suitability: 0.91, risk: "low" },
      { crop: "Maize", suitability: 0.78, risk: "medium" },
    ],
    status: "ready",
  },
  null,
  2
);

export default function Hero({ onGetStarted }: HeroProps) {
  return (
    <section className="relative h-screen w-full overflow-hidden flex items-center bg-hud-bg">
      {/* 3D diorama backdrop */}
      <div className="absolute inset-0 z-0 opacity-90">
        <FarmDiorama />
      </div>

      {/* Left scrim keeps the headline legible; the golden field stays visible on the right */}
      <div className="pointer-events-none absolute inset-0 z-10 bg-gradient-to-r from-hud-bg via-hud-bg/55 to-transparent" />
      {/* Blend the bottom edge into the dark page below */}
      <div className="pointer-events-none absolute inset-0 z-10 bg-gradient-to-t from-hud-bg via-transparent to-transparent" />

      {/* Content */}
      <div className="relative z-20 w-full max-w-7xl mx-auto px-6 sm:px-10 grid grid-cols-1 lg:grid-cols-[1.1fr_0.9fr] gap-12 items-center">
        {/* Left: copy */}
        <div className="space-y-6 text-center lg:text-left">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-hud-panel backdrop-blur-md border border-hud-border rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-hud-green animate-pulse" />
            <span className="font-mono text-[10px] font-bold tracking-widest text-hud-green uppercase">
              $ agent-farmer --init
            </span>
          </div>

          <h1 className="font-sans text-4xl sm:text-5xl md:text-6xl font-extrabold text-hud-text tracking-tight leading-[1.08]">
            AI That Farms{" "}
            <span className="bg-gradient-to-r from-hud-green via-emerald-300 to-hud-blue bg-clip-text text-transparent">
              With You.
            </span>
          </h1>

          <p className="font-sans text-sm sm:text-base md:text-lg text-hud-text-dim font-medium max-w-xl mx-auto lg:mx-0 leading-relaxed">
            The AI operating system for modern agriculture. From precision crop
            planning to automated harvesting — real-time, model-driven insights
            for every field you run.
          </p>

          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4">
            <button
              onClick={onGetStarted}
              className="w-full sm:w-auto px-8 py-3.5 bg-hud-green hover:bg-hud-green/85 text-hud-bg rounded-md text-sm font-bold transition-all duration-200 active:scale-[0.98] flex items-center justify-center gap-2 shadow-hud-glow-green group"
            >
              Get Started
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform duration-200" />
            </button>

            <button
              onClick={() => alert("Demo video placeholder: Set up for hackathon presentation.")}
              className="w-full sm:w-auto px-8 py-3.5 bg-hud-panel hover:bg-white/[0.06] backdrop-blur-md border border-hud-border text-hud-text rounded-md text-sm font-bold transition-all duration-200 active:scale-[0.98] flex items-center justify-center gap-2"
            >
              <Play className="w-4 h-4" />
              Watch Demo
            </button>
          </div>

          <div className="pt-2 font-mono text-[10px] tracking-[0.2em] uppercase text-hud-text-faint">
            0-cost stack &middot; fast setup &middot; production-grade demo
          </div>
        </div>

        {/* Right: floating terminal */}
        <div className="hidden lg:block [transform:perspective(1400px)_rotateY(-8deg)_rotateX(2deg)] hover:[transform:perspective(1400px)_rotateY(-4deg)_rotateX(1deg)] transition-transform duration-500">
          <TerminalWindow title="crop_engine.stream.json" className="w-full max-w-md ml-auto">
            <TypewriterJson json={SAMPLE_JSON} />
          </TerminalWindow>
        </div>
      </div>

      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-20 animate-bounce">
        <svg className="w-6 h-6 text-hud-text-faint" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
        </svg>
      </div>
    </section>
  );
}
