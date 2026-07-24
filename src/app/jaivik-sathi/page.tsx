"use client";

import { useRef, useState } from "react";
import { motion, AnimatePresence, useScroll, useTransform } from "framer-motion";
import SmoothScroll from "@/components/SmoothScroll";
import {
  Menu,
  X,
  Leaf,
  Sprout,
  Bug,
  FlaskConical,
  Recycle,
  Scissors,
  Wind,
  Boxes,
  Cpu,
  Radio,
  Brain,
  Database,
  Sun,
  Users,
  ArrowRight,
  ArrowDown,
  Plus,
} from "lucide-react";
import { LineChart, Line, XAxis, ResponsiveContainer } from "recharts";

const ACCENT = "#c9e87d";

/* Soft edge-fade so the rock image blends into the forest-green void */
const ROCK_MASK =
  "radial-gradient(ellipse 62% 60% at 50% 46%, #000 50%, transparent 78%)";

const NAV_LINKS = [
  { label: "Concept", href: "#concept" },
  { label: "Process", href: "#process" },
  { label: "Intelligence", href: "#intelligence" },
  { label: "Impact", href: "#impact" },
];

/* Monospace data annotations floated over the hero rock */
const HERO_ANNOTATIONS = [
  { top: "24%", left: "60%", value: "+40 t", label: "COMPOST / YEAR" },
  { top: "52%", left: "72%", value: "10,000 L", label: "LIQUID BIO-INPUTS" },
  { top: "70%", left: "54%", value: "100%", label: "SOLAR-POWERED" },
  { top: "40%", left: "46%", value: "25–50", label: "FARMS PER UNIT" },
];

/* Hotspot nodes placed over the full-bleed soil macro */
const SOIL_HOTSPOTS = [
  { top: "27%", left: "76%", label: "CROP RESIDUE\n0 BURNED" },
  { top: "52%", left: "83%", label: "MICROBIAL LIFE\nRESTORED" },
  { top: "82%", left: "18%", label: "LIVING SOIL\nORGANIC MATTER ↑" },
];

/* Cumulative compost output — builds toward the ~40 t/year figure
   (≈20 t by mid-year), from the Jaivik Sathi concept document. */
const CHART_DATA = [
  { m: "JAN", v: 3.3 },
  { m: "FEB", v: 6.7 },
  { m: "MAR", v: 10.0 },
  { m: "APR", v: 13.3 },
  { m: "MAY", v: 16.7 },
  { m: "JUN", v: 20.0 },
];

/* Tiles for the light "bento" color-flip section */
const BENTO_TILES = [
  { src: "/images/tile-hands.png", label: "IN THE FIELD", cap: "Compost, back to the soil that made it" },
  { src: "/images/tile-aerial.png", label: "AT SCALE", cap: "One unit, a whole village of plots" },
  { src: "/images/tile-solar.png", label: "OFF-GRID", cap: "Powered by the sun, start to finish" },
  { src: "/images/tile-leaf.png", label: "THE OUTCOME", cap: "Healthier crops, measurable results" },
];

const PRODUCE = [
  { icon: Sprout, img: "/images/bg-soil.png", name: "Graded Compost", desc: "Crop residue and farm dung, composted in an insulated chamber into clean, screen-graded compost ready for the field.", stat: "~40 t / year" },
  { icon: Bug, img: "/images/obj-vermicompost.png", name: "Vermicompost", desc: "Earthworm beds refine part of the output into nutrient-dense vermicompost for high-value crops.", stat: "~15 t / year" },
  { icon: FlaskConical, img: "/images/obj-bioinput.png", name: "Liquid Bio-Inputs", desc: "Jeevamrutha and panchagavya, brewed on-site in instrumented bioreactors — living microbial fertiliser.", stat: "~10,000 L / year" },
];

const PROCESS = [
  { icon: Recycle, name: "Collect", desc: "Crop residue, cattle dung and village organic waste — gathered instead of burned." },
  { icon: Scissors, name: "Shred", desc: "A solar shredder cuts biomass to size for even, rapid decomposition." },
  { icon: Wind, name: "Compost", desc: "An insulated in-vessel chamber turns and aerates the mix, watched breath-by-breath for heat, moisture and oxygen." },
  { icon: Bug, name: "Vermibeds", desc: "Earthworms convert refined material into premium vermicompost." },
  { icon: FlaskConical, name: "Brew", desc: "Bioreactors culture the living liquid inputs — jeevamrutha and panchagavya." },
  { icon: Boxes, name: "Grade & Bag", desc: "A rotary sieve grades and a station bags the finished product." },
];

const INTELLIGENCE = [
  { icon: Cpu, name: "Sensor-Instrumented", desc: "Soil probes, a weather station, compost-chamber probes and imaging poles watch the farm and the process in real time." },
  { icon: Radio, name: "Connected by LoRaWAN", desc: "A single solar gateway links the farm — and neighbours within about 3 km — into one low-power sensing network." },
  { icon: Brain, name: "AI Advisory", desc: "The farm's own data becomes guidance: what to do, when, and why — Industry 4.0 & 5.0, brought to the field." },
  { icon: Database, name: "Traceable by Batch", desc: "Every batch carries its own record — evidence for quality and certification." },
];

const IMPACT = [
  { icon: Leaf, name: "Soil that lives", desc: "Living compost and microbial inputs rebuild organic matter and soil biology." },
  { icon: Wind, name: "No more burning", desc: "Crop residue becomes a resource, not smoke over the fields." },
  { icon: Sun, name: "Powered by the sun", desc: "Solar-first and grid-light — clean energy from end to end." },
  { icon: Users, name: "Farmers as producers", desc: "A farm stops only buying inputs and starts making — and sharing — them." },
];

const IMPACT_STATS = [
  { value: "40 t", label: "compost a year" },
  { value: "10,000 L", label: "liquid bio-inputs" },
  { value: "25–50", label: "farms served per unit" },
  { value: "3 km", label: "sensing reach" },
  { value: "100%", label: "solar-powered" },
];

/* ── helpers ── */
function Reveal({ children, delay = 0, y = 22, className = "", style }: { children: React.ReactNode; delay?: number; y?: number; className?: string; style?: React.CSSProperties }) {
  return (
    <motion.div
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-12%" }}
      transition={{ duration: 0.8, delay, ease: [0.22, 1, 0.36, 1] }}
      className={className}
      style={style}
    >
      {children}
    </motion.div>
  );
}

function Mono({ children, className = "", style }: { children: React.ReactNode; className?: string; style?: React.CSSProperties }) {
  return (
    <span className={`font-mono text-[11px] uppercase leading-relaxed tracking-[0.18em] ${className}`} style={style}>
      {children}
    </span>
  );
}

function Hotspot({ top, left, label }: { top: string; left: string; label: string }) {
  return (
    <div className="absolute z-10 flex items-center gap-3" style={{ top, left }}>
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full shadow-[0_0_16px_rgba(201,232,125,0.5)]" style={{ background: ACCENT }}>
        <Plus size={15} strokeWidth={2.5} className="text-[#0f1f10]" />
      </span>
      <span className="whitespace-pre-line font-mono text-[10px] uppercase leading-[1.35] tracking-[0.12em] text-[#F5F4F2]">
        {label}
      </span>
    </div>
  );
}

/* Frosted-glass data card with a live line chart */
function GlassChartCard({ className = "" }: { className?: string }) {
  return (
    <div className={`w-[300px] rounded-2xl border border-[#F5F4F2]/15 bg-[#0f1f10]/55 p-6 backdrop-blur-md ${className}`}>
      <div className="text-[14px] font-medium text-[#F5F4F2]">Compost produced</div>
      <Mono className="text-[#F5F4F2]/50">Cumulative · to June</Mono>
      <div className="mt-4 flex items-baseline gap-2 text-[34px] font-medium leading-none text-[#F5F4F2]">
        20 <span className="text-[14px] text-[#F5F4F2]/50">t of ~40 t / yr</span>
      </div>
      <div className="mt-4 h-28">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={CHART_DATA} margin={{ top: 12, right: 6, left: 6, bottom: 0 }}>
            <Line type="monotone" dataKey="v" stroke={ACCENT} strokeWidth={2} dot={{ r: 2, fill: ACCENT, strokeWidth: 0 }} activeDot={false} isAnimationActive={false} />
            <XAxis dataKey="m" tick={{ fill: "rgba(245,244,242,0.4)", fontSize: 9, fontFamily: "monospace" }} axisLine={false} tickLine={false} interval={1} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/* Numbered, click-to-expand capability list */
function NumberedList() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <div className="w-full max-w-md">
      {INTELLIGENCE.map((f, i) => {
        const isOpen = open === i;
        return (
          <button key={f.name} type="button" onClick={() => setOpen(isOpen ? null : i)} className="block w-full border-b border-[#F5F4F2]/15 py-4 text-left">
            <div className="flex items-center gap-4">
              <span className="font-mono text-[12px] text-[#F5F4F2]/40">{String(i + 1).padStart(2, "0")}</span>
              <span className="flex-1 font-mono text-[13px] uppercase tracking-[0.08em] text-[#F5F4F2]">{f.name}</span>
              <Plus size={16} strokeWidth={2} className={`shrink-0 transition-transform duration-300 ${isOpen ? "rotate-45" : ""}`} style={accentTextGlobal} />
            </div>
            <AnimatePresence initial={false}>
              {isOpen && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.3 }} className="overflow-hidden">
                  <p className="pl-9 pt-3 text-[13px] leading-relaxed text-[#F5F4F2]/60">{f.desc}</p>
                </motion.div>
              )}
            </AnimatePresence>
          </button>
        );
      })}
    </div>
  );
}

const accentTextGlobal = { color: ACCENT };

/* Full-bleed background image that pans slower than scroll (parallax) */
function ParallaxBg({ src, className = "" }: { src: string; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], ["-7%", "7%"]);
  return (
    <div ref={ref} className={`absolute inset-0 overflow-hidden ${className}`}>
      <motion.img src={src} alt="" style={{ y }} className="absolute left-0 top-[-7%] h-[114%] w-full object-cover" />
    </div>
  );
}

/* Wraps children in a scroll-linked vertical drift */
function Parallax({ children, from = 60, to = -60, className = "" }: { children: React.ReactNode; from?: number; to?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], [from, to]);
  return (
    <div ref={ref} className={className}>
      <motion.div style={{ y }}>{children}</motion.div>
    </div>
  );
}

export default function JaivikSathiPage() {
  const [menuOpen, setMenuOpen] = useState(false);
  const accentText = { color: ACCENT };

  // Hero rock parallax — drift at different rates over the first screen of scroll
  const { scrollY } = useScroll();
  const rockYMain = useTransform(scrollY, [0, 700], [0, -90]);
  const rockYSat1 = useTransform(scrollY, [0, 700], [0, -230]);
  const rockYSat2 = useTransform(scrollY, [0, 700], [0, -150]);
  const rockYSat3 = useTransform(scrollY, [0, 700], [0, -290]);

  return (
    <SmoothScroll>
      <div className="jaivik-hero relative w-full">
        {/* ── Navigation ── */}
        <nav className="fixed inset-x-0 top-0 z-30 flex items-center justify-between px-5 py-5 sm:px-8">
          <a href="#top" className="flex items-center gap-2.5">
            <span className="flex h-7 w-7 items-center justify-center rounded-md" style={{ background: ACCENT }}>
              <Leaf size={16} strokeWidth={2} className="text-[#0f1f10]" />
            </span>
            <span className="text-[15px] font-medium tracking-tight">Jaivik Sathi</span>
          </a>

          <div className="hidden items-center gap-9 md:flex">
            {NAV_LINKS.map((link) => (
              <a key={link.label} href={link.href} className="font-mono text-[12px] uppercase tracking-[0.14em] text-[#F5F4F2]/70 transition-colors duration-300 hover:text-[#F5F4F2]">
                {link.label}
              </a>
            ))}
          </div>

          <div className="flex items-center gap-4">
            <a href="#connect" className="hidden items-center gap-2 rounded-full px-4 py-2 font-mono text-[12px] uppercase tracking-[0.12em] text-[#0f1f10] transition-transform hover:-translate-y-0.5 sm:inline-flex" style={{ background: ACCENT }}>
              Let&apos;s Talk
              <ArrowRight size={14} strokeWidth={2.5} />
            </a>
            <button type="button" aria-label={menuOpen ? "Close menu" : "Open menu"} className="md:hidden" onClick={() => setMenuOpen((v) => !v)}>
              {menuOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </nav>

        {/* Mobile menu */}
        <AnimatePresence>
          {menuOpen && (
            <motion.div
              className="fixed left-4 right-4 top-16 z-50 flex flex-col items-center gap-5 rounded-2xl border border-[#F5F4F2]/10 bg-[#0b170c]/95 py-8 backdrop-blur-md md:hidden"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
            >
              {NAV_LINKS.map((link, i) => (
                <motion.a key={link.label} href={link.href} className="font-mono text-[13px] uppercase tracking-[0.18em] text-[#F5F4F2]/90"
                  initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 + i * 0.06 }} onClick={() => setMenuOpen(false)}>
                  {link.label}
                </motion.a>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── HERO ── */}
        <section id="top" className="relative h-screen w-full overflow-hidden">
          {/* Floating rock images (main + drifting satellites), parallaxed on scroll */}
          <div className="absolute inset-0 z-0 overflow-hidden" aria-hidden>
            <motion.div className="absolute" style={{ top: "22%", left: "50%", width: "46%", x: "-50%", y: rockYMain }}>
              <img src="/images/obj-rock.png" alt="" draggable={false} className="js-float w-full select-none"
                style={{ animationDuration: "7s", maskImage: ROCK_MASK, WebkitMaskImage: ROCK_MASK }} />
            </motion.div>
            <motion.div className="absolute hidden md:block" style={{ top: "12%", right: "5%", width: "12%", y: rockYSat1 }}>
              <img src="/images/obj-rock.png" alt="" draggable={false} className="js-float w-full select-none opacity-90"
                style={{ animationDuration: "9s", animationDelay: "-2s", maskImage: ROCK_MASK, WebkitMaskImage: ROCK_MASK }} />
            </motion.div>
            <motion.div className="absolute hidden md:block" style={{ bottom: "9%", left: "1%", width: "15%", y: rockYSat2 }}>
              <img src="/images/obj-rock.png" alt="" draggable={false} className="js-float w-full select-none opacity-80"
                style={{ animationDuration: "8.5s", animationDelay: "-4s", maskImage: ROCK_MASK, WebkitMaskImage: ROCK_MASK }} />
            </motion.div>
            <motion.div className="absolute hidden md:block" style={{ bottom: "7%", right: "4%", width: "13%", y: rockYSat3 }}>
              <img src="/images/obj-rock.png" alt="" draggable={false} className="js-float w-full select-none opacity-90"
                style={{ animationDuration: "10s", animationDelay: "-1s", maskImage: ROCK_MASK, WebkitMaskImage: ROCK_MASK }} />
            </motion.div>
          </div>

          {/* Hero copy */}
          <div className="pointer-events-none relative z-10 flex h-full flex-col justify-start px-5 pt-32 sm:px-8 sm:pt-36">
            <div className="js-fade-up max-w-[46rem]" style={{ animationDelay: "0.15s" }}>
              <h1 className="text-[clamp(2.2rem,5.2vw,4.8rem)] font-medium leading-[1.05] tracking-[-0.02em] text-[#F5F4F2]">
                Where Soil, Solar &amp; Intelligence Meet
              </h1>
            </div>

            <a href="#concept" style={{ background: ACCENT, animationDelay: "0.5s" }}
              className="js-fade-up pointer-events-auto mt-8 inline-flex w-fit items-center gap-2.5 rounded-full px-6 py-3 font-mono text-[12px] uppercase tracking-[0.14em] text-[#0f1f10] transition-transform hover:-translate-y-0.5">
              Explore the Concept
              <ArrowRight size={15} strokeWidth={2.5} />
            </a>
          </div>

          {/* Monospace annotations over the rock */}
          {HERO_ANNOTATIONS.map((a, i) => (
            <div key={a.label} className="js-fade-in pointer-events-none absolute z-10 hidden -translate-x-1/2 md:block"
              style={{ top: a.top, left: a.left, animationDelay: `${1.2 + i * 0.15}s` }}>
              <div className="h-px w-8" style={{ background: ACCENT }} />
              <div className="mt-2 text-[15px] font-medium">{a.value}</div>
              <Mono className="text-[#F5F4F2]/55">{a.label}</Mono>
            </div>
          ))}

          {/* Targeting reticle + data chip over the main rock */}
          <div className="js-fade-in pointer-events-none absolute left-[49%] top-[52%] z-10 hidden -translate-x-1/2 -translate-y-1/2 md:block" style={{ animationDelay: "1.9s" }}>
            <div className="relative h-40 w-40">
              {(["left-0 top-0 border-l border-t", "right-0 top-0 border-r border-t", "bottom-0 left-0 border-b border-l", "bottom-0 right-0 border-b border-r"] as const).map((pos) => (
                <span key={pos} className={`absolute h-5 w-5 border-[#F5F4F2]/40 ${pos}`} />
              ))}
              <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 rounded bg-[#F5F4F2] px-2 py-[3px]">
                <span className="font-mono text-[11px] tracking-[0.06em] text-[#0f1f10]">&minus;8.3 tCO&#8322;e</span>
              </div>
            </div>
          </div>

          {/* Supporting line + scroll cue */}
          <div className="absolute inset-x-0 bottom-8 z-10 flex items-end justify-between px-5 sm:px-8">
            <p className="max-w-[42ch] text-[14px] leading-relaxed text-[#F5F4F2]/70 sm:text-[15px]">
              <span className="text-[#F5F4F2]">Know your soil—precisely.</span> A solar-powered unit that turns farm waste into living inputs, monitored by sensors and guided by AI.
            </p>
            <div className="hidden items-center gap-2 text-[#F5F4F2]/50 sm:flex">
              <Mono>Scroll to discover</Mono>
              <div className="js-bounce">
                <ArrowDown size={16} />
              </div>
            </div>
          </div>
        </section>

        {/* ── STATEMENT over full-bleed soil macro + hotspots ── */}
        <section id="concept" className="js-anchor relative min-h-[100svh] w-full overflow-hidden">
          <ParallaxBg src="/images/bg-soil.png" />
          {/* legibility scrim */}
          <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, rgba(15,31,16,0.9) 0%, rgba(15,31,16,0.45) 42%, rgba(15,31,16,0.7) 100%)" }} />
          {/* seamless fades into the page green top & bottom */}
          <div className="absolute inset-x-0 top-0 h-40" style={{ background: "linear-gradient(#0f1f10, transparent)" }} />
          <div className="absolute inset-x-0 bottom-0 h-40" style={{ background: "linear-gradient(transparent, #0f1f10)" }} />

          <div className="relative z-10 mx-auto flex min-h-[100svh] max-w-[1200px] flex-col justify-center px-5 py-28 sm:px-8">
            <Reveal>
              <Mono className="text-[#c9e87d]">Real-time · Sensor-verified · Soil intelligence</Mono>
            </Reveal>
            <Reveal delay={0.05}>
              <h2 className="mt-8 max-w-[22ch] text-[clamp(1.9rem,4.4vw,3.6rem)] font-medium leading-[1.12] tracking-[-0.02em] text-[#F5F4F2]">
                Jaivik Sathi turns crop residue, dung and farm waste into graded compost and living bio-inputs — measured, monitored and traceable. A farm doesn&apos;t just grow crops. It produces value.
              </h2>
            </Reveal>
          </div>

          {/* data hotspots (desktop) */}
          <div className="pointer-events-none absolute inset-0 z-10 hidden md:block">
            {SOIL_HOTSPOTS.map((h) => (
              <Hotspot key={h.label} top={h.top} left={h.left} label={h.label} />
            ))}
          </div>
        </section>

        {/* ── WHAT IT PRODUCES ── */}
        <section className="relative mx-auto max-w-[1200px] px-5 py-24 sm:px-8 sm:py-32">
          <Reveal className="mb-16 flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
            <h3 className="max-w-[16ch] text-[clamp(1.6rem,3vw,2.6rem)] font-medium leading-[1.1] tracking-[-0.02em]">Three outputs from one cycle</h3>
            <Mono className="text-[#F5F4F2]/45">01 — Production</Mono>
          </Reveal>
          <div className="grid gap-6 md:grid-cols-3">
            {PRODUCE.map((p, i) => (
              <Reveal key={p.name} delay={i * 0.08} className="h-full">
                <div className="group flex h-full flex-col overflow-hidden rounded-2xl border border-[#F5F4F2]/10 bg-[#F5F4F2]/[0.02] transition-colors duration-300 hover:border-[#c9e87d]/30">
                  <div className="relative aspect-[4/3] overflow-hidden">
                    <img src={p.img} alt="" className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105" />
                    <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, transparent 40%, rgba(15,31,16,0.85))" }} />
                    <div className="absolute left-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-[#0f1f10]/60 backdrop-blur-sm">
                      <p.icon size={18} strokeWidth={1.6} style={accentText} />
                    </div>
                    <div className="absolute bottom-3 right-4 text-[14px] font-medium" style={accentText}>{p.stat}</div>
                  </div>
                  <div className="flex flex-1 flex-col p-6">
                    <h4 className="text-[19px] font-medium">{p.name}</h4>
                    <p className="mt-2.5 flex-1 text-[14px] leading-relaxed text-[#F5F4F2]/55">{p.desc}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </section>

        {/* ── PROCESS ── */}
        <section id="process" className="js-anchor relative mx-auto max-w-[1200px] px-5 py-24 sm:px-8 sm:py-32">
          <Reveal className="mb-16 flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
            <div>
              <h3 className="max-w-[18ch] text-[clamp(1.6rem,3vw,2.6rem)] font-medium leading-[1.1] tracking-[-0.02em]">Waste in, worth out — in six steps</h3>
              <p className="mt-4 text-[14px] text-[#F5F4F2]/50">Every stage runs on the sun.</p>
            </div>
            <Mono className="text-[#F5F4F2]/45">02 — Process</Mono>
          </Reveal>
          <div className="grid gap-x-10 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
            {PROCESS.map((step, i) => (
              <Reveal key={step.name} delay={i * 0.05}>
                <div className="border-t border-[#F5F4F2]/12 pt-5">
                  <div className="flex items-center justify-between">
                    <step.icon size={24} strokeWidth={1.5} style={accentText} />
                    <span className="font-mono text-[13px] text-[#F5F4F2]/35">{String(i + 1).padStart(2, "0")}</span>
                  </div>
                  <h4 className="mt-5 text-[17px] font-medium">{step.name}</h4>
                  <p className="mt-2 text-[14px] leading-relaxed text-[#F5F4F2]/55">{step.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </section>

        {/* ── THE UNIT ── */}
        <section className="relative mx-auto max-w-[1200px] px-5 py-24 sm:px-8 sm:py-32">
          <div className="grid items-center gap-12 lg:grid-cols-2">
            <Reveal>
              <Mono className="text-[#c9e87d]">The machine</Mono>
              <h3 className="mt-6 max-w-[16ch] text-[clamp(1.7rem,3.4vw,2.8rem)] font-medium leading-[1.1] tracking-[-0.02em]">
                A bio-input factory that fits on the farm.
              </h3>
              <p className="mt-6 max-w-[52ch] text-[15px] leading-relaxed text-[#F5F4F2]/60">
                Shredder, insulated composting chamber, vermibeds and a bagging station — solar-powered and sensor-instrumented. One compact unit turns a farm&apos;s own waste into graded compost and living bio-inputs.
              </p>
              <div className="mt-9 flex flex-wrap gap-x-12 gap-y-5">
                {[["500 kg", "processed / day"], ["100%", "solar-powered"], ["1 unit", "serves 25–50 farms"]].map(([v, l]) => (
                  <div key={l}>
                    <div className="text-[clamp(1.4rem,2.4vw,2rem)] font-medium tracking-[-0.02em]">{v}</div>
                    <Mono className="text-[#F5F4F2]/45">{l}</Mono>
                  </div>
                ))}
              </div>
            </Reveal>
            <Parallax from={50} to={-50}>
              <img src="/images/obj-unit.png" alt="A solar-powered on-farm composting unit" className="js-float w-full select-none" style={{ animationDuration: "8s", maskImage: ROCK_MASK, WebkitMaskImage: ROCK_MASK }} />
            </Parallax>
          </div>
        </section>

        {/* ── MEASURED — misty field + glass chart card + numbered list ── */}
        <section id="intelligence" className="js-anchor relative min-h-[100svh] w-full overflow-hidden">
          <ParallaxBg src="/images/bg-field-mist.png" />
          <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, rgba(15,31,16,0.55) 0%, rgba(15,31,16,0.2) 35%, rgba(15,31,16,0.82) 100%)" }} />
          <div className="absolute inset-x-0 top-0 h-40" style={{ background: "linear-gradient(#0f1f10, transparent)" }} />
          <div className="absolute inset-x-0 bottom-0 h-40" style={{ background: "linear-gradient(transparent, #0f1f10)" }} />

          <div className="relative z-10 mx-auto flex min-h-[100svh] max-w-[1200px] flex-col justify-center px-5 py-28 sm:px-8">
            <Reveal>
              <Mono className="text-[#c9e87d]">↗ 03 — The intelligence layer</Mono>
            </Reveal>
            <Reveal delay={0.05}>
              <h3 className="mt-6 max-w-[16ch] text-[clamp(1.8rem,4vw,3.2rem)] font-medium leading-[1.1] tracking-[-0.02em] text-[#F5F4F2]">
                Measured. Not estimated.
              </h3>
            </Reveal>
            <div className="mt-14 flex flex-col gap-12 lg:flex-row lg:items-start lg:justify-between">
              <Reveal>
                <GlassChartCard />
              </Reveal>
              <Reveal delay={0.1}>
                <NumberedList />
              </Reveal>
            </div>
          </div>
        </section>

        {/* ── COMMUNITY ── */}
        <section className="relative px-5 py-24 sm:px-8 sm:py-32">
          <Reveal className="mx-auto max-w-[1000px] rounded-3xl border p-10 sm:p-16" style={{ borderColor: "rgba(201,232,125,0.2)", background: "rgba(201,232,125,0.04)" }}>
            <Mono style={accentText}>One unit, a whole village</Mono>
            <h3 className="mt-6 max-w-[22ch] text-[clamp(1.6rem,3.4vw,2.8rem)] font-medium leading-[1.1] tracking-[-0.02em]">Bought by one farm. Shared by many.</h3>
            <p className="mt-6 max-w-[60ch] text-[15px] leading-relaxed text-[#F5F4F2]/65 sm:text-[16px]">
              The anchor farm produces the inputs and runs the network. Twenty-five to fifty neighbouring smallholders plug in — receiving inputs and advisory, and joining the shared sensing grid. A local, circular economy that grows outward from a single point.
            </p>
          </Reveal>
        </section>

        {/* ── LIGHT COLOR-FLIP: the problem + bento tiles ── */}
        <section className="relative w-full bg-[#f3f4ee] px-5 py-28 text-[#0f1f10] sm:px-8 sm:py-40">
          <div className="mx-auto max-w-[1200px]">
            <Reveal className="mx-auto max-w-[42ch] text-center">
              <span className="inline-block rounded-full px-3.5 py-1.5 font-mono text-[11px] uppercase tracking-[0.14em] text-[#0f1f10]" style={{ background: ACCENT }}>
                Jaivik Sathi solves
              </span>
              <h2 className="mt-8 text-[clamp(2rem,4.6vw,3.4rem)] font-medium leading-[1.08] tracking-[-0.02em]">
                The problem isn&apos;t the harvest. It&apos;s what the farm throws away.
              </h2>
              <p className="mx-auto mt-6 max-w-[52ch] text-[16px] leading-relaxed text-[#0f1f10]/60">
                Burned residue, bought fertiliser, wasted organic matter — Jaivik Sathi turns all three into value the farm keeps.
              </p>
            </Reveal>

            <div className="mt-16 grid grid-cols-2 gap-4 sm:gap-6 lg:grid-cols-4">
              {BENTO_TILES.map((t, i) => (
                <Reveal key={t.label} delay={i * 0.07}>
                  <Parallax from={i % 2 === 0 ? 40 : 12} to={i % 2 === 0 ? -28 : -64}>
                    <div className="group relative aspect-[3/4] overflow-hidden rounded-2xl">
                      <img src={t.src} alt="" className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105" />
                      <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, transparent 42%, rgba(15,31,16,0.82))" }} />
                      <div className="absolute inset-x-4 bottom-4">
                        <span className="font-mono text-[10px] uppercase tracking-[0.14em]" style={accentText}>{t.label}</span>
                        <p className="mt-1 text-[13px] font-medium leading-snug text-[#F5F4F2]">{t.cap}</p>
                      </div>
                    </div>
                  </Parallax>
                </Reveal>
              ))}
            </div>

            <div className="mt-4 grid grid-cols-2 gap-4 sm:mt-6 sm:gap-6 lg:grid-cols-4">
              {([["−8.3 tCO₂e", "avoided / yr per unit"], ["40 t", "compost / year"], ["25–50", "farms served"], ["100%", "solar-powered"]] as const).map(([v, l]) => (
                <Reveal key={l}>
                  <div className="rounded-2xl p-6" style={{ background: ACCENT }}>
                    <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-[#0f1f10]/60">{l}</div>
                    <div className="mt-3 text-[clamp(1.4rem,2.4vw,2rem)] font-medium tracking-[-0.02em] text-[#0f1f10]">{v}</div>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* ── IMPACT ── */}
        <section id="impact" className="js-anchor relative mx-auto max-w-[1200px] px-5 py-24 sm:px-8 sm:py-32">
          <Reveal className="mb-16 flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
            <h3 className="max-w-[14ch] text-[clamp(1.6rem,3vw,2.6rem)] font-medium leading-[1.1] tracking-[-0.02em]">Value where it&apos;s grown</h3>
            <Mono className="text-[#F5F4F2]/45">04 — Impact</Mono>
          </Reveal>
          <div className="grid gap-x-10 gap-y-12 sm:grid-cols-2 lg:grid-cols-4">
            {IMPACT.map((it, i) => (
              <Reveal key={it.name} delay={i * 0.07}>
                <div className="border-t border-[#F5F4F2]/12 pt-5">
                  <it.icon size={24} strokeWidth={1.5} style={accentText} />
                  <h4 className="mt-5 text-[16px] font-medium">{it.name}</h4>
                  <p className="mt-2 text-[14px] leading-relaxed text-[#F5F4F2]/55">{it.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>

          {/* Stat band */}
          <Reveal delay={0.1} className="mt-20">
            <div className="flex flex-wrap items-end justify-between gap-x-10 gap-y-8 border-t border-[#F5F4F2]/12 pt-10">
              {IMPACT_STATS.map((s) => (
                <div key={s.label}>
                  <div className="text-[clamp(1.8rem,4vw,3rem)] font-medium tracking-[-0.02em]">{s.value}</div>
                  <Mono className="text-[#F5F4F2]/45">{s.label}</Mono>
                </div>
              ))}
            </div>
          </Reveal>
        </section>

        {/* ── VISION ── */}
        <section id="connect" className="relative px-5 py-32 text-center sm:py-48">
          <Reveal>
            <h2 className="mx-auto max-w-[20ch] text-[clamp(2.2rem,6vw,5rem)] font-medium leading-[1.05] tracking-[-0.02em]">
              A companion of the soil.
            </h2>
          </Reveal>
          <Reveal delay={0.08}>
            <a href="#top" className="mt-10 inline-flex items-center gap-2.5 rounded-full px-7 py-3.5 font-mono text-[12px] uppercase tracking-[0.14em] text-[#0f1f10] transition-transform hover:-translate-y-0.5" style={{ background: ACCENT }}>
              जैविक साथी · Jaivik Sathi
              <ArrowRight size={15} strokeWidth={2.5} />
            </a>
          </Reveal>
          <Reveal delay={0.14}>
            <div className="mt-12"><Mono className="text-[#F5F4F2]/35">MSME Idea Hackathon 6.0 — Industry 4.0 &amp; 5.0 · Agriculture &amp; Allied Industries</Mono></div>
          </Reveal>
        </section>

        {/* ── FOOTER — giant wordmark over moss ── */}
        <footer className="relative w-full overflow-hidden">
          <ParallaxBg src="/images/bg-footer-moss.png" />
          <div className="absolute inset-0 bg-[#0f1f10]/55" />
          <div className="absolute inset-x-0 top-0 h-40" style={{ background: "linear-gradient(#0f1f10, transparent)" }} />

          <div className="relative z-10 px-5 pb-10 pt-40 sm:px-8 sm:pt-56">
            <div className="mx-auto max-w-[1280px]">
              <h2 className="whitespace-nowrap text-center font-medium leading-[0.85] tracking-[-0.03em]" style={{ color: ACCENT, fontSize: "clamp(2rem, 12.5vw, 11rem)" }}>
                Jaivik Sathi
              </h2>

              <div className="mt-20 flex flex-col gap-10 border-t border-[#F5F4F2]/12 pt-10 sm:flex-row sm:justify-between">
                <div>
                  <div className="text-[16px] font-medium text-[#F5F4F2]">जैविक साथी</div>
                  <p className="mt-3 max-w-[26ch] text-[13px] leading-relaxed text-[#F5F4F2]/55">
                    A companion of the soil. A Future Us initiative, building the soil economy.
                  </p>
                </div>
                <div className="flex gap-12 sm:gap-16">
                  <div>
                    <Mono className="text-[#F5F4F2]/40">Explore</Mono>
                    <ul className="mt-4 space-y-2.5">
                      {NAV_LINKS.map((l) => (
                        <li key={l.label}>
                          <a href={l.href} className="text-[14px] text-[#F5F4F2]/70 transition-colors hover:text-[#F5F4F2]">{l.label}</a>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <Mono className="text-[#F5F4F2]/40">Context</Mono>
                    <ul className="mt-4 space-y-2.5 text-[14px] text-[#F5F4F2]/70">
                      <li>MSME Hackathon 6.0</li>
                      <li>Industry 4.0 &amp; 5.0</li>
                      <li>Agriculture &amp; Allied</li>
                    </ul>
                  </div>
                </div>
              </div>

              <div className="mt-12 flex items-center justify-between">
                <Mono className="text-[#F5F4F2]/40">© {new Date().getFullYear()} Jaivik Sathi</Mono>
                <a href="#top" className="flex items-center gap-2 text-[13px] text-[#F5F4F2]/60 transition-colors hover:text-[#F5F4F2]">
                  Back to top
                  <ArrowRight size={14} className="-rotate-90" />
                </a>
              </div>
            </div>
          </div>
        </footer>
      </div>
    </SmoothScroll>
  );
}
