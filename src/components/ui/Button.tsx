import React from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md";

/**
 * Redesign v2 — a real three-step hierarchy. Primary is a solid deep-green
 * surface, secondary a bordered white surface, ghost carries no chrome until
 * hovered. Weight drops from `font-bold` to `font-semibold`: at these sizes
 * bold was shouting, and hierarchy now comes from surface, not weight.
 */
const variants: Record<Variant, string> = {
  primary: "bg-af-primary hover:bg-af-primary-deep text-white",
  secondary: "bg-af-card hover:bg-af-bg text-af-ink border border-af-border hover:border-af-primary/30",
  ghost: "bg-transparent hover:bg-af-sage text-af-ink-2 hover:text-af-ink",
  danger: "bg-af-danger/10 hover:bg-af-danger/15 text-af-danger",
};

const sizes: Record<Size, string> = {
  sm: "px-4 py-2 text-meta gap-1.5 rounded-[10px]",
  md: "px-5 py-2.5 text-sm gap-2 rounded-[12px]",
};

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
};

export default function Button({
  variant = "primary",
  size = "md",
  className = "",
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={`inline-flex items-center justify-center font-semibold tracking-[-0.01em] transition-all duration-200 ease-out active:scale-[0.99] outline-none focus-visible:ring-2 focus-visible:ring-af-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-af-bg disabled:opacity-50 disabled:pointer-events-none ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
