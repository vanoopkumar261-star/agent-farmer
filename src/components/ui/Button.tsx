import React from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md";

const variants: Record<Variant, string> = {
  primary: "bg-af-primary hover:bg-af-primary-deep text-white shadow-af-sm",
  secondary: "bg-af-card hover:bg-af-bg text-af-ink border border-af-border",
  ghost: "bg-transparent hover:bg-af-bg text-af-ink-2 hover:text-af-ink",
  danger: "bg-af-danger/10 hover:bg-af-danger/15 text-af-danger",
};

const sizes: Record<Size, string> = {
  sm: "px-3.5 py-2 text-[13px] gap-1.5 rounded-[10px]",
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
      className={`inline-flex items-center justify-center font-bold transition-all duration-150 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
