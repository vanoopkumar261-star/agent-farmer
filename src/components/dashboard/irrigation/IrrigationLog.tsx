"use client";

/**
 * What was actually applied, and when.
 *
 * This is the feature's only real memory. Without it the engine has to guess
 * where today's water balance starts, and says so; with one logged watering it
 * can carry the balance forward from a known wetting. That is the difference
 * between "an estimate" and "modelled" on the provenance line, and it is also
 * the "historical irrigation data" the whole prediction is supposed to learn
 * from.
 *
 * Writes go straight to Supabase from the browser under RLS, the same path
 * `SoilPhScanner` uses for pH readings — there is no server route to add,
 * because the row is the farmer's own and the policy already enforces it.
 */

import { useState } from "react";
import { createPortal } from "react-dom";
import { Droplets, Plus, X, History, Loader2, IndianRupee } from "lucide-react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { useT } from "@/components/i18n/LanguageProvider";
import { supabase } from "@/lib/supabase";
import type { IrrigationEventRow } from "@/lib/history";

export default function IrrigationLog({
  farmerId,
  farmId,
  farmLabel,
  events,
  suggestedMm,
  suggestedLitres,
  suggestedMinutes,
}: {
  farmerId: string;
  farmId: string;
  farmLabel: string;
  events: IrrigationEventRow[];
  suggestedMm?: number;
  suggestedLitres?: number;
  suggestedMinutes?: number;
}) {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState(events);

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-1">
        <div className="flex items-center gap-2">
          <History className="w-4 h-4 text-af-muted" />
          <h3 className="font-semibold text-af-ink">{t("irrigation.log.title")}</h3>
        </div>
        <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>
          <Plus className="w-4 h-4" />
          {t("irrigation.log.record")}
        </Button>
      </div>

      {rows.length === 0 ? (
        <p className="mt-3 text-sm text-af-ink-2">
          {t("irrigation.log.empty", { farm: farmLabel })}
        </p>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left font-mono text-[10px] font-bold tracking-[0.18em] uppercase text-af-muted">
                <th className="pb-2 pr-4 font-bold">{t("irrigation.log.when")}</th>
                <th className="pb-2 pr-4 font-bold">{t("irrigation.log.depth")}</th>
                <th className="pb-2 pr-4 font-bold">{t("irrigation.log.volume")}</th>
                <th className="pb-2 pr-4 font-bold">{t("irrigation.log.run")}</th>
                <th className="pb-2 font-bold">{t("irrigation.log.cost")}</th>
              </tr>
            </thead>
            <tbody className="text-af-ink-2">
              {rows.slice(0, 10).map((r) => (
                <tr key={r.id} className="border-t border-af-border">
                  <td className="py-2 pr-4 whitespace-nowrap">
                    {new Date(r.applied_at).toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "short",
                    })}
                  </td>
                  <td className="py-2 pr-4">{r.depth_mm != null ? `${r.depth_mm} mm` : "—"}</td>
                  <td className="py-2 pr-4">
                    {r.volume_litres != null
                      ? `${Math.round(r.volume_litres).toLocaleString("en-IN")} L`
                      : "—"}
                  </td>
                  <td className="py-2 pr-4">
                    {r.duration_minutes != null ? `${r.duration_minutes} min` : "—"}
                  </td>
                  <td className="py-2">
                    {r.cost_rupees != null ? `₹${Math.round(r.cost_rupees)}` : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {open && (
        <LogModal
          farmerId={farmerId}
          farmId={farmId}
          farmLabel={farmLabel}
          suggestedMm={suggestedMm}
          suggestedLitres={suggestedLitres}
          suggestedMinutes={suggestedMinutes}
          onClose={() => setOpen(false)}
          onSaved={(row) => {
            setRows((prev) => [row, ...prev]);
            setOpen(false);
          }}
        />
      )}
    </Card>
  );
}

function LogModal({
  farmerId,
  farmId,
  farmLabel,
  suggestedMm,
  suggestedLitres,
  suggestedMinutes,
  onClose,
  onSaved,
}: {
  farmerId: string;
  farmId: string;
  farmLabel: string;
  suggestedMm?: number;
  suggestedLitres?: number;
  suggestedMinutes?: number;
  onClose: () => void;
  onSaved: (row: IrrigationEventRow) => void;
}) {
  // Prefilled from the plan when there is one, because the common case is "I
  // did what you suggested" — but every field stays editable, since what was
  // actually applied is the only thing worth recording.
  const [depth, setDepth] = useState(suggestedMm ? String(suggestedMm) : "");
  const [litres, setLitres] = useState(suggestedLitres ? String(Math.round(suggestedLitres)) : "");
  const [minutes, setMinutes] = useState(suggestedMinutes ? String(suggestedMinutes) : "");
  const { t } = useT();
  const [cost, setCost] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const num = (s: string) => {
    const n = Number(s);
    return s.trim() !== "" && Number.isFinite(n) && n >= 0 ? n : null;
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    const payload = {
      farmer_id: farmerId,
      farm_id: farmId,
      applied_at: new Date().toISOString(),
      depth_mm: num(depth),
      volume_litres: num(litres),
      duration_minutes: num(minutes) == null ? null : Math.round(num(minutes)!),
      cost_rupees: num(cost),
      source: suggestedMm ? "scheduled" : "manual",
    };

    const { data, error: err } = await supabase
      .from("irrigation_events")
      .insert(payload)
      .select()
      .single();

    if (err) {
      // 42P01 = table missing, i.e. migration 029 has not run here.
      setError(
        err.code === "42P01"
          ? t("irrigation.log.errNoTable")
          : t("irrigation.log.errSave")
      );
      setSaving(false);
      return;
    }

    // A pump costs money to run, and "Irrigation" is already a category in the
    // ledger — so a cost recorded here lands in the farmer's books rather than
    // in a silo only this page can see. That is also what lets water savings
    // eventually be stated in rupees and not only litres.
    //
    // Best-effort on purpose: the watering is the record that matters and is
    // already safely saved. A failed bookkeeping row must not look like a
    // failed log, so it is not surfaced as an error.
    const rupees = num(cost);
    if (rupees && rupees > 0) {
      const { error: expErr } = await supabase.from("farm_expenses").insert([
        {
          farmer_id: farmerId,
          kind: "expense",
          category: "Irrigation",
          item_name: `Watering — ${farmLabel}`,
          amount: rupees,
          txn_date: new Date().toISOString().slice(0, 10),
        },
      ]);
      if (expErr) console.warn("irrigation cost not added to the ledger:", expErr.message);
    }

    onSaved(data as IrrigationEventRow);
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[9998] flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-6"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-md rounded-t-[20px] sm:rounded-[20px] bg-af-card border border-af-border shadow-af-float p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <h3 className="font-semibold text-af-ink flex items-center gap-2">
              <Droplets className="w-4 h-4 text-af-primary" />
              {t("irrigation.log.record")}
            </h3>
            <p className="text-xs text-af-muted mt-0.5">
              {farmLabel} · {t("irrigation.log.today")}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label={t("irrigation.log.close")}
            className="text-af-muted hover:text-af-ink transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-xs text-af-ink-2 mb-4">{t("irrigation.log.hint")}</p>

        <div className="grid grid-cols-2 gap-3">
          <Field
            label={t("irrigation.log.fieldDepth")}
            value={depth}
            onChange={setDepth}
            placeholder="e.g. 25"
          />
          <Field
            label={t("irrigation.log.fieldVolume")}
            value={litres}
            onChange={setLitres}
            placeholder="e.g. 90000"
          />
          <Field
            label={t("irrigation.log.fieldRun")}
            value={minutes}
            onChange={setMinutes}
            placeholder="e.g. 120"
          />
          <Field
            label={t("irrigation.log.fieldCost")}
            value={cost}
            onChange={setCost}
            placeholder="e.g. 250"
            icon
          />
        </div>

        {error && <p className="mt-3 text-xs text-af-danger">{error}</p>}

        <div className="mt-5 flex gap-2">
          <Button variant="ghost" onClick={onClose} className="flex-1">
            {t("irrigation.log.cancel")}
          </Button>
          <Button
            onClick={save}
            disabled={saving || (!depth && !litres && !minutes)}
            className="flex-1"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {t("irrigation.log.save")}
          </Button>
        </div>
      </div>
    </div>,
    document.body
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  icon,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  icon?: boolean;
}) {
  return (
    <label className="space-y-1.5">
      <span className="font-mono text-[10px] font-bold tracking-[0.18em] uppercase text-af-muted">
        {label}
      </span>
      <span className="relative block">
        {icon && (
          <IndianRupee className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-af-muted" />
        )}
        <input
          type="number"
          inputMode="decimal"
          min={0}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={`w-full rounded-[14px] bg-af-bg border border-af-border py-3 text-sm text-af-ink outline-none focus:ring-2 focus:ring-af-primary/25 focus:border-af-primary/40 transition ${
            icon ? "pl-8 pr-3" : "px-3"
          }`}
        />
      </span>
    </label>
  );
}
