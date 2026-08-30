"use client";

/**
 * Removes a farm from the "My Farms" card.
 *
 * Two-step, in-place confirmation rather than a `window.confirm` — a native
 * dialog blocks the whole page and reads as a browser alert rather than as part
 * of the product. The first click arms the button and names what will go; a
 * second click (or Escape / clicking elsewhere in the row) resolves it.
 *
 * Deleting takes the farm's crop cycle and tasks with it, so the copy says so.
 * `router.refresh()` re-runs the server components, which is what makes the
 * farm count, total area, harvest list and alerts all settle together.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Loader2, AlertTriangle } from "lucide-react";
import { deleteFarm } from "@/lib/db";
import { useT } from "@/components/i18n/LanguageProvider";

export default function DeleteFarmButton({
  farmId,
  farmIndex,
  cropName,
}: {
  farmId: string;
  farmIndex: number;
  cropName?: string;
}) {
  const router = useRouter();
  const { t } = useT();
  const [armed, setArmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const confirm = async () => {
    setBusy(true);
    setError(null);
    const ok = await deleteFarm(farmId);
    if (!ok) {
      setError(t("deleteFarmButton.error"));
      setBusy(false);
      setArmed(false);
      return;
    }
    // Leave the button busy — the row disappears when the refresh lands.
    router.refresh();
  };

  if (error) {
    return (
      <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-af-danger">
        <AlertTriangle className="w-3.5 h-3.5" />
        {error}
      </span>
    );
  }

  if (!armed) {
    return (
      <button
        type="button"
        onClick={() => setArmed(true)}
        aria-label={t("deleteFarmButton.ariaDelete", { n: farmIndex })}
        className="inline-flex items-center justify-center w-8 h-8 rounded-[10px] text-af-muted transition hover:bg-af-danger/10 hover:text-af-danger outline-none focus-visible:ring-2 focus-visible:ring-af-danger/40"
      >
        <Trash2 className="w-4 h-4" />
      </button>
    );
  }

  return (
    <span className="inline-flex items-center gap-2">
      <span className="text-[12px] text-af-ink-2">
        {t("deleteFarmButton.confirmText", { n: farmIndex })}
        {cropName ? ` (${cropName})` : ""}?
      </span>
      <button
        type="button"
        onClick={confirm}
        disabled={busy}
        className="inline-flex items-center gap-1 rounded-[10px] bg-af-danger/10 px-2.5 py-1 text-[12px] font-semibold text-af-danger transition hover:bg-af-danger/15 disabled:opacity-50 outline-none focus-visible:ring-2 focus-visible:ring-af-danger/40"
      >
        {busy && <Loader2 className="w-3 h-3 animate-spin" />}
        {busy ? t("deleteFarmButton.deleting") : t("deleteFarmButton.delete")}
      </button>
      <button
        type="button"
        onClick={() => setArmed(false)}
        disabled={busy}
        className="rounded-[10px] px-2 py-1 text-[12px] font-semibold text-af-muted transition hover:text-af-ink disabled:opacity-50 outline-none focus-visible:ring-2 focus-visible:ring-af-primary/40"
      >
        {t("dashboard.cancel")}
      </button>
    </span>
  );
}
