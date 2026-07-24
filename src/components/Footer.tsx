"use client";

import { Terminal, Globe, Mail } from "lucide-react";

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="relative overflow-hidden bg-hud-bg px-6 pt-20 pb-10">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            "radial-gradient(900px circle at 15% 40%, rgba(57,255,176,0.06), transparent 60%), radial-gradient(800px circle at 85% 30%, rgba(76,158,255,0.05), transparent 62%)",
        }}
      />

      <div className="relative z-10 max-w-7xl mx-auto">
        <div className="rounded-[32px] bg-hud-panel backdrop-blur-xl border border-hud-border shadow-[0_18px_60px_rgba(0,0,0,0.4)] p-10 md:p-12">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-10">
            {/* Brand */}
            <div className="md:col-span-5 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-[14px] bg-hud-green/10 border border-hud-green/25 flex items-center justify-center">
                  <Terminal className="w-5 h-5 text-hud-green" />
                </div>
                <div>
                  <div className="font-sans font-extrabold text-xl text-hud-text tracking-tight leading-none">
                    AgentFarmer
                  </div>
                  <div className="font-mono text-[10px] tracking-[0.22em] text-hud-green/70 uppercase mt-1">
                    Terra-Tech OS
                  </div>
                </div>
              </div>

              <p className="font-sans text-sm md:text-base text-hud-text-dim leading-relaxed max-w-md">
                Enterprise-grade agricultural management that blends AI precision with the organic reality of farming—from crop planning to harvest.
              </p>

              <div className="flex items-center gap-3 pt-2 text-hud-text-dim">
                <IconPill label="Website" aria="Website">
                  <Globe className="w-4 h-4" />
                </IconPill>

                <IconPill label="Email" aria="Email">
                  <Mail className="w-4 h-4" />
                </IconPill>

                <TextPill text="GH" aria="GitHub" />
                <TextPill text="IN" aria="LinkedIn" />
                <TextPill text="X" aria="Twitter / X" />
              </div>
            </div>

            {/* Links */}
            <div className="md:col-span-7 grid grid-cols-2 sm:grid-cols-3 gap-8">
              <FooterCol
                title="Product"
                links={[
                  { label: "Features", href: "#features" },
                  { label: "How It Works", href: "#how-it-works" },
                  { label: "AI Assistant", href: "#ai-assistant" },
                  { label: "Pricing (Soon)", href: "#" },
                ]}
              />
              <FooterCol
                title="Company"
                links={[
                  { label: "About", href: "#about" },
                  { label: "Contact", href: "#" },
                  { label: "Support", href: "#" },
                ]}
              />
              <FooterCol
                title="Legal"
                links={[
                  { label: "Privacy Policy", href: "#" },
                  { label: "Terms of Service", href: "#" },
                  { label: "Consent & AI Use", href: "#" },
                ]}
              />
            </div>
          </div>

          <div className="mt-10 h-px w-full bg-gradient-to-r from-transparent via-hud-border to-transparent" />

          <div className="mt-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="text-sm text-hud-text-faint">
              © {year} AgentFarmer — Terra-Tech OS. All rights reserved.
            </div>

            <div className="font-mono text-[10px] tracking-[0.22em] uppercase text-hud-text-faint">
              Built for 0-cost deployment • Hackathon Demo
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({
  title,
  links,
}: {
  title: string;
  links: { label: string; href: string }[];
}) {
  return (
    <div className="space-y-4">
      <div className="font-mono text-[10px] font-bold tracking-[0.22em] uppercase text-hud-text-faint">
        {title}
      </div>
      <ul className="space-y-2">
        {links.map((l) => (
          <li key={l.label}>
            <a
              href={l.href}
              className="font-sans text-sm text-hud-text-dim hover:text-hud-green transition"
            >
              {l.label}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

function IconPill({
  children,
  label,
  aria,
}: {
  children: React.ReactNode;
  label: string;
  aria: string;
}) {
  return (
    <a
      href="#"
      aria-label={aria}
      className="inline-flex items-center gap-2 px-3 h-10 rounded-full bg-white/[0.03] border border-hud-border hover:bg-white/[0.06] transition"
    >
      {children}
      <span className="font-mono text-[10px] font-bold tracking-[0.18em] uppercase">
        {label}
      </span>
    </a>
  );
}

function TextPill({ text, aria }: { text: string; aria: string }) {
  return (
    <a
      href="#"
      aria-label={aria}
      className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-white/[0.03] border border-hud-border hover:bg-white/[0.06] transition font-mono text-[10px] font-bold tracking-[0.22em] uppercase text-hud-text-dim"
    >
      {text}
    </a>
  );
}
