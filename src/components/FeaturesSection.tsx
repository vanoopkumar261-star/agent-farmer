"use client";

import {
  Sprout,
  CloudSun,
  Microscope,
  TrendingUp,
  MapPin,
  Wallet,
  ArrowRight,
} from "lucide-react";
import { motion } from "framer-motion";

const features = [
  {
    icon: Sprout,
    label: "ai_crop_engine.ts",
    title: "Smart Crop Recommendations",
    description:
      "Our AI analyzes your soil type, irrigation source, location, and weather patterns to recommend the 3 most profitable crops for each of your registered fields.",
    color: "text-hud-green",
    accent: "#39ffb0",
  },
  {
    icon: CloudSun,
    label: "weather_intel.ts",
    title: "7-Day Farm Forecast",
    description:
      "Real-time hyper-local weather monitoring with soil moisture, UV index, AQI, humidity, and storm alerts personalized to your exact farm GPS coordinates.",
    color: "text-hud-blue",
    accent: "#4c9eff",
  },
  {
    icon: Microscope,
    label: "disease_vision.ts",
    title: "Plant Disease Detection",
    description:
      "Upload a photo of any affected leaf. Our AI instantly identifies the disease, severity level, affected area, treatment plan, and estimated recovery timeline.",
    color: "text-hud-green",
    accent: "#39ffb0",
  },
  {
    icon: TrendingUp,
    label: "market_analytics.ts",
    title: "Strategic Market Intelligence",
    description:
      "Live national agricultural commodity prices, historical trend charts, seasonal demand forecasts, and AI-powered optimal selling window recommendations.",
    color: "text-hud-blue",
    accent: "#4c9eff",
  },
  {
    icon: MapPin,
    label: "geo_locator.ts",
    title: "Fertilizer Store Locator",
    description:
      "Automatically finds the nearest fertilizer shops, seed stores, and manure suppliers within a 20km radius of your registered home location on an interactive map.",
    color: "text-hud-amber",
    accent: "#ffb454",
  },
  {
    icon: Wallet,
    label: "expense_ledger.ts",
    title: "Farm Expense Notebook",
    description:
      "A clean digital ledger to record seeds, fertilizers, labor, machinery, and transport costs. Auto-calculates total investment, income, and seasonal net profit.",
    color: "text-hud-amber",
    accent: "#ffb454",
  },
];

export default function FeaturesSection() {
  return (
    <section id="features" className="relative overflow-hidden bg-hud-bg py-24 px-6">
      {/* Ambient grid texture */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.35]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(57,255,176,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(57,255,176,0.05) 1px, transparent 1px)",
          backgroundSize: "56px 56px",
          maskImage: "radial-gradient(ellipse at 50% 30%, black 0%, transparent 70%)",
        }}
      />
      <div className="absolute top-0 left-1/4 w-[600px] h-[600px] rounded-full bg-hud-green/[0.05] blur-[130px] pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] rounded-full bg-hud-blue/[0.06] blur-[110px] pointer-events-none" />

      <div className="max-w-7xl mx-auto relative z-10">
        <div className="text-center mb-16 space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-hud-panel border border-hud-border rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-hud-green animate-pulse" />
            <span className="font-mono text-[9px] font-bold tracking-widest text-hud-green uppercase">
              platform.capabilities
            </span>
          </div>
          <h2 className="font-sans text-4xl md:text-5xl font-extrabold text-hud-text tracking-tight">
            Everything Your Farm Needs.
            <br />
            <span className="text-hud-green">In One OS.</span>
          </h2>
          <p className="font-sans text-base text-hud-text-dim max-w-xl mx-auto leading-relaxed">
            Agent Farmer combines six intelligent modules into one unified platform
            that monitors, advises, and optimizes your entire crop lifecycle.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-10%" }}
              transition={{ duration: 0.5, delay: (index % 3) * 0.08 }}
              className="group relative overflow-hidden rounded-2xl bg-hud-panel backdrop-blur-xl border border-hud-border hover:border-hud-border-strong transition-all duration-300 hover:-translate-y-1.5 cursor-pointer"
            >
              {/* Title bar */}
              <div className="flex items-center gap-2 border-b border-hud-border px-4 py-3 bg-white/[0.02]">
                <div className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-hud-red/60" />
                  <span className="h-2 w-2 rounded-full bg-hud-amber/60" />
                  <span className="h-2 w-2 rounded-full bg-hud-green/60" />
                </div>
                <span className="ml-2 font-mono text-[10px] tracking-wide text-hud-text-faint truncate">
                  {feature.label}
                </span>
              </div>

              <div
                className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                style={{
                  background: `radial-gradient(ellipse at top left, ${feature.accent}14 0%, transparent 70%)`,
                }}
              />

              <div className="relative z-10 p-7">
                <div
                  className="w-12 h-12 rounded-[12px] flex items-center justify-center mb-6 border"
                  style={{ backgroundColor: `${feature.accent}14`, borderColor: `${feature.accent}30` }}
                >
                  <feature.icon className={`w-5 h-5 ${feature.color}`} />
                </div>

                <h3 className="font-sans text-lg font-bold text-hud-text mt-1 mb-3 leading-tight">
                  {feature.title}
                </h3>

                <p className="font-sans text-sm text-hud-text-dim leading-relaxed">
                  {feature.description}
                </p>

                <div className="mt-6 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                  <span className={`font-mono text-xs font-semibold ${feature.color}`}>
                    learn_more()
                  </span>
                  <ArrowRight className={`w-3.5 h-3.5 ${feature.color}`} />
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
