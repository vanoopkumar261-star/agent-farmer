"use client";

import { motion } from "framer-motion";
import React from "react";

/** Fade-up on scroll into view. Use `index` to stagger a grid/list. */
export default function Reveal({
  children,
  index = 0,
  className = "",
  "data-tour": dataTour,
}: {
  children: React.ReactNode;
  index?: number;
  className?: string;
  /**
   * Anchor id for the first-run tutorial (see `components/dashboard/tour`).
   * Declared explicitly rather than spreading `...rest`, so the one attribute
   * the tour needs is forwarded without this component quietly accepting any
   * DOM prop callers happen to pass.
   */
  "data-tour"?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay: Math.min(index * 0.06, 0.4), ease: [0.22, 1, 0.36, 1] }}
      className={className}
      data-tour={dataTour}
    >
      {children}
    </motion.div>
  );
}
