"use client";

import React, { useEffect, useRef, useState } from "react";
import { useInView } from "framer-motion";
import { highlightJson } from "./highlightJson";

type TypewriterJsonProps = {
  json: string;
  speed?: number;
  className?: string;
};

export default function TypewriterJson({ json, speed = 14, className = "" }: TypewriterJsonProps) {
  const ref = useRef<HTMLPreElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-10% 0px" });
  const [visibleChars, setVisibleChars] = useState(0);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!isInView) return;

    const reduceMotion =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (reduceMotion) {
      setVisibleChars(json.length);
      setDone(true);
      return;
    }

    let i = 0;
    const id = setInterval(() => {
      i += 1;
      setVisibleChars(i);
      if (i >= json.length) {
        clearInterval(id);
        setDone(true);
      }
    }, speed);

    return () => clearInterval(id);
  }, [isInView, json, speed]);

  const visibleText = json.slice(0, visibleChars);

  return (
    <pre
      ref={ref}
      className={`font-mono text-[12px] sm:text-[13px] leading-relaxed whitespace-pre-wrap break-words ${className}`}
    >
      {highlightJson(visibleText)}
      {!done && <span className="inline-block w-[7px] h-[14px] -mb-[2px] bg-hud-green animate-hud-blink ml-0.5" />}
    </pre>
  );
}
