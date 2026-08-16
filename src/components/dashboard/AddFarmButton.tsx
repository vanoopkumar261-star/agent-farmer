"use client";

import { useState } from "react";
import AddFarmModal from "@/components/dashboard/AddFarmModal";

/**
 * Opens the "Add a farm" popup.
 *
 * A thin client wrapper so server components (the dashboard page) and client
 * components (the sidebar) can both host the modal without either owning its
 * state. `variant` covers the two places it appears: the sidebar's primary
 * button and the inline link above Your Farms.
 */
export default function AddFarmButton({
  variant = "link",
  label,
  className,
  children,
}: {
  variant?: "link" | "custom";
  label?: string;
  className?: string;
  children?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={
          className ??
          (variant === "link"
            ? "text-sm font-semibold text-af-primary-deep hover:underline"
            : undefined)
        }
      >
        {children ?? label ?? "+ Add farm"}
      </button>

      {open && <AddFarmModal onClose={() => setOpen(false)} />}
    </>
  );
}
