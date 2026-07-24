"use client";

import React from 'react';
import { Terminal, ArrowRight } from 'lucide-react';

type HeaderProps = {
  onGetStarted: () => void;
};

export default function Header({ onGetStarted }: HeaderProps) {
  return (
    <header className="fixed top-4 left-1/2 -translate-x-1/2 w-[92%] max-w-7xl z-50 transition-all duration-300">
      <div className="bg-hud-panel backdrop-blur-xl border border-hud-border rounded-md px-6 py-3 shadow-[0_4px_30px_rgba(0,0,0,0.35)] flex items-center justify-between">

        {/* Brand Logo & Name */}
        <div className="flex items-center gap-2.5 cursor-pointer group">
          <div className="w-8 h-8 rounded-sm bg-hud-green/10 flex items-center justify-center text-hud-green border border-hud-green/25 group-hover:scale-105 transition-transform duration-200">
            <Terminal className="w-4 h-4" />
          </div>
          <span className="font-sans font-bold text-lg text-hud-text tracking-tight">
            Agent<span className="text-hud-green font-extrabold">Farmer</span>
          </span>
        </div>

        {/* Central Navigation Links */}
        <nav className="hidden md:flex items-center gap-8">
          <a href="#features" className="font-mono text-[11px] font-semibold tracking-wide text-hud-text-dim hover:text-hud-green transition-colors">
            features
          </a>
          <a href="#how-it-works" className="font-mono text-[11px] font-semibold tracking-wide text-hud-text-dim hover:text-hud-green transition-colors">
            how-it-works
          </a>
          <a href="#ai-assistant" className="font-mono text-[11px] font-semibold tracking-wide text-hud-text-dim hover:text-hud-green transition-colors">
            ai-assistant
          </a>
          <a href="#about" className="font-mono text-[11px] font-semibold tracking-wide text-hud-text-dim hover:text-hud-green transition-colors">
            about
          </a>
        </nav>

        {/* Right CTA Action Buttons */}
        <div className="flex items-center gap-4">
          <span className="hidden sm:inline font-mono text-[10px] font-bold tracking-wider text-hud-blue/80 uppercase">
            Pricing (soon)
          </span>
          <button
            onClick={onGetStarted}
            className="px-5 py-2 bg-hud-green hover:bg-hud-green/85 text-hud-bg rounded-sm text-xs font-bold transition-all duration-200 active:scale-[0.98] flex items-center gap-1.5 shadow-hud-glow-green"
          >
            Contact <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

      </div>
    </header>
  );
}
