"use client";

import { useState } from "react";
import { ShieldAlert } from "lucide-react";
import { useT } from "@/components/i18n/LanguageProvider";
import HazardCheckModal from "./HazardCheckModal";

/**
 * The front door to the emergency check, rendered inside the Alerts card.
 *
 * Exists as its own client component so `AlertsCard` can stay a server
 * component — it renders on every dashboard load and has no reason to ship
 * interactivity to the browser just to hold one boolean.
 *
 * The modal is mounted only once opened, so the check never fires on page load:
 * it runs because the farmer asked, which is also what keeps the rate limit and
 * the SACHET feed calm.
 */
export default function HazardCheckButton() {
  const { t } = useT();
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="mt-4 w-full inline-flex items-center justify-center gap-2 rounded-xl border border-af-danger/30 bg-af-danger/[0.06] px-4 py-2.5 text-[13px] font-semibold text-af-danger hover:bg-af-danger/[0.11] hover:border-af-danger/45 transition"
      >
        <ShieldAlert className="w-4 h-4" />
        {t("hazardCheck.button")}
      </button>

      {open && <HazardCheckModal onClose={() => setOpen(false)} />}
    </>
  );
}
