"use client";

import { ArrowRight, BrainCircuit, LayoutDashboard, Sprout, UserPlus } from "lucide-react";
import { motion } from "framer-motion";

const steps = [
  {
    number: "01",
    icon: UserPlus,
    title: "Register Your Farm",
    description:
      "Create your profile and register each agricultural field with GPS location, soil type, area, and irrigation source.",
    accent: "#39ffb0",
  },
  {
    number: "02",
    icon: BrainCircuit,
    title: "AI Farm Analysis",
    description:
      "Our AI automatically gathers weather data, soil moisture, historical rainfall, and vegetation patterns for your exact coordinates.",
    accent: "#4c9eff",
  },
  {
    number: "03",
    icon: Sprout,
    title: "Smart Crop Selection",
    description:
      "Receive 3 personalized crop recommendations per field with yield estimates, profit projections, and risk scores.",
    accent: "#39ffb0",
  },
  {
    number: "04",
    icon: LayoutDashboard,
    title: "Dashboard Monitoring",
    description:
      "Track daily tasks, weather alerts, disease detection, fertilizer schedules, and market prices from one command center.",
    accent: "#ffb454",
  },
];

export default function HowItWorksSection() {
  return (
    <section id="how-it-works" className="relative overflow-hidden bg-hud-bg py-28 px-6">
      {/* Ambient glow mesh */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            "radial-gradient(900px circle at 18% 18%, rgba(57,255,176,0.06), transparent 60%), radial-gradient(800px circle at 82% 22%, rgba(76,158,255,0.06), transparent 62%), radial-gradient(700px circle at 40% 92%, rgba(57,255,176,0.05), transparent 58%)",
        }}
      />

      <div className="relative z-10 mx-auto max-w-7xl">
        {/* Header */}
        <div className="mx-auto mb-16 max-w-3xl text-center space-y-5">
          <div className="inline-flex items-center gap-2 rounded-full bg-hud-panel backdrop-blur border border-hud-border px-4 py-2">
            <span className="font-mono text-[10px] font-bold tracking-[0.22em] text-hud-blue uppercase">
              user_journey.map()
            </span>
          </div>

          <h2 className="font-sans text-4xl md:text-6xl font-extrabold tracking-tight text-hud-text leading-[1.05]">
            From Registration to <span className="text-hud-green">Harvest</span> in 4 Steps.
          </h2>

          <p className="font-sans text-base md:text-lg text-hud-text-dim leading-relaxed">
            Agent Farmer guides you through every stage of the crop lifecycle with intelligent automation and personalized insights.
          </p>
        </div>

        {/* Cards */}
        <div className="relative">
          <DataConnector />

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10 relative z-10">
            {steps.map((step, idx) => {
              const Icon = step.icon;

              return (
                <motion.div
                  key={step.number}
                  initial={{ opacity: 0, y: 28 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-10%" }}
                  transition={{ duration: 0.55, delay: idx * 0.12 }}
                  className="relative"
                >
                  {idx < steps.length - 1 && (
                    <div className="hidden lg:flex pointer-events-none absolute -right-6 top-[52px] items-center justify-center">
                      <div className="w-10 h-10 rounded-full bg-hud-panel backdrop-blur border border-hud-border flex items-center justify-center">
                        <ArrowRight className="w-4 h-4 text-hud-text-faint" />
                      </div>
                    </div>
                  )}

                  <div className="group relative overflow-hidden rounded-2xl bg-hud-panel backdrop-blur-xl border border-hud-border hover:border-hud-border-strong shadow-[0_10px_40px_rgba(0,0,0,0.35)] transition-all duration-300 hover:-translate-y-1">
                    {/* Title bar */}
                    <div className="flex items-center justify-between border-b border-hud-border px-4 py-2.5 bg-white/[0.02]">
                      <span className="font-mono text-[10px] font-bold tracking-[0.2em] text-hud-text-faint">
                        STEP_{step.number}
                      </span>
                      <div
                        className="h-8 w-8 rounded-[10px] flex items-center justify-center border"
                        style={{ backgroundColor: `${step.accent}14`, borderColor: `${step.accent}30` }}
                      >
                        <Icon className="w-4 h-4" style={{ color: step.accent }} />
                      </div>
                    </div>

                    <div className="relative z-10 p-7">
                      <h3 className="font-sans text-xl font-extrabold text-hud-text leading-tight">
                        {step.title}
                      </h3>

                      <p className="mt-4 font-sans text-sm text-hud-text-dim leading-relaxed">
                        {step.description}
                      </p>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

function DataConnector() {
  return (
    <div className="hidden lg:block pointer-events-none absolute left-[8%] right-[8%] top-[52px] h-[2px] z-0">
      <svg className="w-full h-full" viewBox="0 0 1000 2" preserveAspectRatio="none">
        <defs>
          <linearGradient id="dataGrad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="rgba(57,255,176,0.05)" />
            <stop offset="50%" stopColor="rgba(57,255,176,0.4)" />
            <stop offset="100%" stopColor="rgba(57,255,176,0.05)" />
          </linearGradient>
        </defs>
        <line x1="0" y1="1" x2="1000" y2="1" stroke="url(#dataGrad)" strokeWidth="2" strokeDasharray="6 10" className="dataFlow" />
      </svg>
      <style jsx>{`
        .dataFlow {
          animation: dataDash 2.4s linear infinite;
        }
        @keyframes dataDash {
          from { stroke-dashoffset: 0; }
          to { stroke-dashoffset: -64; }
        }
        @media (prefers-reduced-motion: reduce) {
          .dataFlow { animation: none; }
        }
      `}</style>
    </div>
  );
}
