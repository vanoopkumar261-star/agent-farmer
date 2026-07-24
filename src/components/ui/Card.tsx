import React from "react";

type CardProps = {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
  as?: "div" | "section" | "article";
};

/** Standard app card — white surface, hairline border, soft shadow, subtle top highlight. */
export default function Card({ children, className = "", hover = false, as = "div" }: CardProps) {
  const Comp = as as any;
  return (
    <Comp
      className={`af-spotlight relative rounded-2xl bg-af-card border border-af-border shadow-af-sm ${
        hover ? "transition-all duration-200 hover:shadow-af-md hover:-translate-y-0.5" : ""
      } ${className}`}
    >
      {/* emerald-tinted top edge for the lifted-glass feel */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px rounded-t-2xl bg-gradient-to-r from-transparent via-af-primary/40 to-transparent" />
      {children}
    </Comp>
  );
}
