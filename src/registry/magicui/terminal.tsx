"use client";

import React, { useEffect, useState } from "react";

/* MagicUI-style Terminal (self-contained — no shadcn/cn or framer dependency).
   <Terminal> auto-sequences its children so the boot log cascades even when no
   explicit `delay` is passed. Reveal is a plain CSS transition driven by a
   delayed state flip — deterministic and lightweight. */

function cn(...parts: (string | undefined | false)[]) {
  return parts.filter(Boolean).join(" ");
}

interface AnimatedSpanProps {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}

export const AnimatedSpan = ({ children, delay = 0, className }: AnimatedSpanProps) => {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setShown(true), delay);
    return () => clearTimeout(t);
  }, [delay]);
  return (
    <div
      className={cn(
        "grid text-[13px] font-normal leading-relaxed tracking-tight transition-all duration-300",
        shown ? "translate-y-0 opacity-100" : "-translate-y-1 opacity-0",
        className
      )}
    >
      {children}
    </div>
  );
};

interface TypingAnimationProps {
  children: string;
  className?: string;
  duration?: number;
  delay?: number;
}

export const TypingAnimation = ({ children, className, duration = 22, delay = 0 }: TypingAnimationProps) => {
  const text = typeof children === "string" ? children : "";
  const [displayed, setDisplayed] = useState("");
  const [started, setStarted] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setStarted(true), delay);
    return () => clearTimeout(t);
  }, [delay]);

  useEffect(() => {
    if (!started) return;
    let i = 0;
    const id = setInterval(() => {
      if (i < text.length) {
        setDisplayed(text.slice(0, i + 1));
        i += 1;
      } else {
        clearInterval(id);
      }
    }, duration);
    return () => clearInterval(id);
  }, [started, text, duration]);

  return (
    <div className={cn("text-[13px] font-normal leading-relaxed tracking-tight", className)}>
      {displayed}
      {started && displayed.length < text.length && (
        <span className="ml-0.5 inline-block h-3.5 w-1.5 -translate-y-px animate-hud-blink bg-emerald-400 align-middle" />
      )}
    </div>
  );
};

export const Terminal = ({ children, className }: { children: React.ReactNode; className?: string }) => {
  // Cumulative auto-sequencing across children.
  let cumulative = 300;
  const seq = React.Children.map(children, (child) => {
    if (!React.isValidElement(child)) return child;
    const props = child.props as { delay?: number; duration?: number; children?: unknown };
    const delay = props.delay ?? cumulative;
    if (child.type === TypingAnimation) {
      const len = typeof props.children === "string" ? props.children.length : 20;
      const dur = props.duration ?? 22;
      cumulative = delay + len * dur + 250;
    } else {
      cumulative = delay + 250;
    }
    return React.cloneElement(child as React.ReactElement, { delay });
  });

  return (
    <div
      className={cn(
        "w-full max-w-[560px] overflow-hidden rounded-2xl border border-white/10 bg-[#0a1310] shadow-of-float",
        className
      )}
    >
      <div className="flex items-center gap-2 border-b border-white/10 px-4 py-3">
        <span className="h-3 w-3 rounded-full bg-[#ff5f57]" />
        <span className="h-3 w-3 rounded-full bg-[#febc2e]" />
        <span className="h-3 w-3 rounded-full bg-[#28c840]" />
        <span className="ml-2 font-mono text-[11px] uppercase tracking-[0.14em] text-white/40">
          agent-farmer — boot
        </span>
      </div>
      <div className="grid min-h-[320px] gap-1 p-5 font-mono text-white/85">{seq}</div>
    </div>
  );
};
