import React from "react";

type CardProps = {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
  as?: "div" | "section" | "article";
};

/**
 * Standard app surface — white, hairline border, whisper of a shadow.
 *
 * Redesign v2: 16px radius per the design direction, and the gradient top edge
 * is gone. That highlight was a glassmorphism cue; the surface now reads as
 * paper, and separation comes from the border rather than from lighting.
 */
export default function Card({ children, className = "", hover = false, as = "div" }: CardProps) {
  const Comp = as as any;
  return (
    <Comp
      className={`af-spotlight relative rounded-[16px] bg-af-card border border-af-border shadow-af-sm ${
        hover ? "transition-all duration-200 ease-out hover:shadow-af-md hover:border-af-primary/25" : ""
      } ${className}`}
    >
      {children}
    </Comp>
  );
}
