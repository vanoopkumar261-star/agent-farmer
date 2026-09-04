"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Upload,
  Loader2,
  RefreshCw,
  X,
  Camera,
  Check,
  AlertTriangle,
  Pencil,
} from "lucide-react";
import Card from "@/components/ui/Card";
import { supabase } from "@/lib/supabase";
import { useT } from "@/components/i18n/LanguageProvider";
import { phBand } from "@/lib/soilPh";
import { soilFix } from "@/lib/soilFix";
import { cropStageFor } from "@/lib/agronomy";
import type { PhReadingResult } from "@/lib/soilReading";

type Farm = {
  id: string;
  farm_index: number;
  soil_type: string;
  crop: { chosen_crop: string; seeding_date: string; estimated_harvest_date: string | null } | null;
};

export default function SoilPhScanner({
  farmerId,
  farms,
}: {
  farmerId: string;
  farms: Farm[];
}) {
  const router = useRouter();
  const { t } = useT();
  const inputRef = useRef<HTMLInputElement>(null);

  const [preview, setPreview] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [reading, setReading] = useState(false);

  // The confirm step is shown once we have an AI read OR the farmer chose manual.
  const [detected, setDetected] = useState<PhReadingResult | null>(null);
  const [manual, setManual] = useState(false);
  const [phInput, setPhInput] = useState("");
  // Defaults to the first farm rather than blank. The reading is now the input
  // to crop-specific advice, so "which field?" stopped being optional — and a
  // null farm_id was also losing the link from reading to crop in the history.
  const [farmId, setFarmId] = useState<string>(farms[0]?.id ?? "");
  const [note, setNote] = useState("");

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const confirming = detected !== null || manual;
  const phNum = Number(phInput);
  const phValid = phInput !== "" && Number.isFinite(phNum) && phNum >= 0 && phNum <= 14;
  /**
   * The one-line version of the soil advice, for the field the farmer picked.
   * Falls back to null (and so to the generic band advice) when the farm has no
   * crop cycle or the pH is fine for it.
   */
  const cropLine = useMemo(() => {
    if (!phValid) return null;
    const farm = farms.find((f) => f.id === farmId);
    if (!farm?.crop) return null;
    const stage = cropStageFor(
      farm.crop.chosen_crop,
      farm.crop.seeding_date,
      farm.crop.estimated_harvest_date
    );
    const fix = soilFix({
      ph: phNum,
      crop: farm.crop.chosen_crop,
      soilType: farm.soil_type,
      stage,
    });
    const first = fix.now[0];
    return first ? t(first.key, first.params) : null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phValid, phNum, farmId, farms, t]);

  const band = useMemo(() => (phValid ? phBand(phNum) : null), [phValid, phNum]);

  function pick(f: File | null | undefined) {
    if (!f) return;
    setFile(f);
    setDetected(null);
    setManual(false);
    setError(null);
    setSaved(false);
    setPreview(URL.createObjectURL(f));
  }

  function reset() {
    setPreview(null);
    setFile(null);
    setDetected(null);
    setManual(false);
    setPhInput("");
    setNote("");
    setError(null);
    setSaved(false);
  }

  async function readPh() {
    if (!file) return;
    setReading(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("image", file);
      const res = await fetch("/api/soil-reading", { method: "POST", body: fd });
      if (res.status === 429) {
        setError(t("soilPh.rateLimited"));
        return;
      }
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error ?? t("soilPh.networkError"));
        return;
      }
      const result = data as PhReadingResult;
      setDetected(result);
      setPhInput(result.ph != null ? result.ph.toFixed(1) : "");
    } catch {
      setError(t("soilPh.networkError"));
    } finally {
      setReading(false);
    }
  }

  async function save() {
    if (!phValid) return;
    setSaving(true);
    setError(null);
    const { error: dbErr } = await supabase.from("soil_readings").insert({
      farmer_id: farmerId,
      farm_id: farmId || null,
      ph: Math.round(phNum * 10) / 10,
      source: detected ? "photo" : "manual",
      ai_confidence: detected?.confidence ?? null,
      note: note.trim() || null,
    });
    setSaving(false);
    if (dbErr) {
      setError(t("soilPh.saveError"));
      return;
    }
    setSaved(true);
    router.refresh();
    setTimeout(() => {
      reset();
    }, 1400);
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* ── Capture panel ─────────────────────────────────────────────── */}
      <Card className="p-6">
        <div className="flex items-center gap-2.5 mb-4">
          <span className="flex items-center justify-center w-9 h-9 rounded-xl bg-af-sage text-af-secondary">
            <Camera className="w-[18px] h-[18px]" />
          </span>
          <div>
            <h2 className="text-[17px] font-semibold tracking-[-0.02em] text-af-ink leading-tight">
              {t("soilPh.uploadTitle")}
            </h2>
            <p className="text-meta text-af-muted">{t("soilPh.uploadHint")}</p>
          </div>
        </div>

        {!preview && !manual ? (
          <>
            <button
              onClick={() => inputRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragging(false);
                pick(e.dataTransfer.files?.[0]);
              }}
              className={`w-full rounded-2xl border-2 border-dashed transition-colors flex flex-col items-center justify-center py-16 px-6 ${
                dragging
                  ? "border-af-primary bg-af-primary/5"
                  : "border-af-border bg-af-bg hover:border-af-primary/40"
              }`}
            >
              <span className="flex items-center justify-center w-14 h-14 rounded-2xl bg-af-primary/10 text-af-primary-deep">
                <Upload className="w-6 h-6" />
              </span>
              <div className="mt-4 text-sm font-semibold text-af-ink">{t("soilPh.readButton")}</div>
              <div className="mt-1 text-[12px] text-af-muted">{t("soilPh.uploadHint")}</div>
            </button>
            <button
              onClick={() => {
                setManual(true);
                setPhInput("");
              }}
              className="mt-3 inline-flex items-center gap-1.5 text-[13px] font-semibold text-af-primary-deep hover:underline"
            >
              <Pencil className="w-3.5 h-3.5" /> {t("soilPh.manualLink")}
            </button>
          </>
        ) : preview ? (
          <div className="relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={preview}
              alt=""
              className="w-full h-[280px] object-cover rounded-2xl border border-af-border"
            />
            <button
              onClick={reset}
              className="absolute top-3 right-3 flex items-center justify-center w-8 h-8 rounded-full bg-af-ink/70 text-white hover:bg-af-ink transition"
            >
              <X className="w-4 h-4" />
            </button>
            {reading && (
              <div className="absolute inset-0 rounded-2xl bg-af-ink/25 backdrop-blur-[1px] flex items-center justify-center">
                <span className="inline-flex items-center gap-2 rounded-full bg-af-card px-4 py-2 text-sm font-semibold text-af-ink shadow-af-md">
                  <Loader2 className="w-4 h-4 animate-spin text-af-primary" /> {t("soilPh.reading")}
                </span>
              </div>
            )}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-af-border bg-af-bg px-5 py-8 text-center">
            <Pencil className="w-6 h-6 text-af-muted mx-auto" />
            <p className="mt-2 text-sm text-af-ink-2">{t("soilPh.confirmValue")}</p>
            <button
              onClick={() => {
                setManual(false);
                setPhInput("");
              }}
              className="mt-3 inline-flex items-center gap-1.5 text-[13px] font-semibold text-af-primary-deep hover:underline"
            >
              <Camera className="w-3.5 h-3.5" /> {t("soilPh.photoLink")}
            </button>
          </div>
        )}

        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => pick(e.target.files?.[0])}
        />

        {preview && !detected && (
          <div className="mt-4 flex gap-3">
            <button
              onClick={reset}
              className="inline-flex items-center justify-center gap-2 rounded-[12px] bg-af-card border border-af-border px-4 py-3 text-sm font-semibold text-af-ink hover:bg-af-bg transition"
            >
              <RefreshCw className="w-4 h-4" /> {t("soilPh.change")}
            </button>
            <button
              onClick={readPh}
              disabled={reading}
              className="flex-1 inline-flex items-center justify-center gap-2 rounded-[12px] bg-af-primary hover:bg-af-primary-deep text-white px-5 py-3 text-sm font-semibold transition active:scale-[0.98] shadow-af-sm disabled:opacity-50"
            >
              {reading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
              {reading ? t("soilPh.reading") : t("soilPh.readButton")}
            </button>
          </div>
        )}
      </Card>

      {/* ── Confirm panel ─────────────────────────────────────────────── */}
      <Card className="p-6 min-h-[380px]">
        {!confirming && !error && (
          <div className="h-full flex flex-col items-center justify-center text-center text-af-muted">
            <Camera className="w-10 h-10 opacity-25" />
            <p className="mt-3 text-sm max-w-[26ch]">{t("soilPh.subtitle")}</p>
          </div>
        )}

        {error && (
          <div className="flex items-start gap-2 rounded-[16px] bg-af-danger/10 border border-af-danger/20 px-4 py-3 mb-4">
            <AlertTriangle className="w-4 h-4 text-af-danger mt-0.5 shrink-0" />
            <div className="text-sm text-af-ink-2">{error}</div>
          </div>
        )}

        {confirming && !saved && (
          <div className="space-y-5">
            {detected && detected.ph == null && (
              <div className="flex items-start gap-2 rounded-[14px] border border-af-amber/25 bg-af-amber/10 px-4 py-3">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-af-amber-ink" />
                <div className="text-sm text-af-ink-2 leading-relaxed">
                  {t("soilPh.couldNotRead")}
                  {detected.rawText && (
                    <span className="block mt-1 font-mono text-[12px] text-af-muted">
                      {t("soilPh.rawSeen", { raw: detected.rawText })}
                    </span>
                  )}
                </div>
              </div>
            )}

            <div>
              <div className="font-mono text-[10px] font-semibold tracking-[0.16em] uppercase text-af-muted">
                {detected ? t("soilPh.detected") : t("soilPh.confirmValue")}
              </div>
              <div className="mt-1 flex items-baseline gap-2">
                <span
                  className="text-4xl font-semibold tabular-nums text-af-ink"
                  style={band ? { color: band.color } : undefined}
                >
                  {phValid ? phNum.toFixed(1) : "—"}
                </span>
                <span className="text-sm text-af-muted">pH</span>
                {band && (
                  <span
                    className="ml-auto rounded-full px-2.5 py-1 text-[11px] font-semibold"
                    style={{ backgroundColor: `${band.color}1a`, color: band.color }}
                  >
                    {t(`soilPh.band.${band.key}.label`)}
                  </span>
                )}
              </div>
              <input
                type="range"
                min={0}
                max={14}
                step={0.1}
                value={phValid ? phNum : 7}
                onChange={(e) => setPhInput(e.target.value)}
                className="mt-3 w-full accent-af-primary"
                style={band ? { accentColor: band.color } : undefined}
              />
              <input
                type="number"
                min={0}
                max={14}
                step={0.1}
                value={phInput}
                onChange={(e) => setPhInput(e.target.value)}
                placeholder="0.0 – 14.0"
                className="mt-2 w-28 rounded-[10px] border border-af-border bg-af-bg px-3 py-2 text-sm font-mono text-af-ink outline-none focus:border-af-primary"
              />
              {/* Crop-aware where we can be, generic where we cannot. The band
                  advice is about soil in the abstract; once we know a wheat
                  crop is standing in this field, the useful sentence is about
                  wheat. */}
              {band && (
                <p className="mt-2 text-meta text-af-ink-2 leading-relaxed">
                  {cropLine ?? t(`soilPh.band.${band.key}.advice`)}
                </p>
              )}
            </div>

            {farms.length > 1 && (
              <label className="block">
                <span className="font-mono text-[10px] font-semibold tracking-[0.16em] uppercase text-af-muted">
                  {t("soilPh.farmLabel")}
                </span>
                <select
                  value={farmId}
                  onChange={(e) => setFarmId(e.target.value)}
                  className="mt-1 w-full rounded-[10px] border border-af-border bg-af-bg px-3 py-2 text-sm text-af-ink outline-none focus:border-af-primary"
                >
                  {farms.map((f) => (
                    <option key={f.id} value={f.id}>
                      Farm {f.farm_index}
                    </option>
                  ))}
                </select>
              </label>
            )}

            <label className="block">
              <span className="font-mono text-[10px] font-semibold tracking-[0.16em] uppercase text-af-muted">
                {t("soilPh.noteLabel")}
              </span>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value.slice(0, 200))}
                rows={2}
                placeholder={t("soilPh.notePlaceholder")}
                className="mt-1 w-full resize-none rounded-[10px] border border-af-border bg-af-bg px-3 py-2 text-sm text-af-ink outline-none focus:border-af-primary"
              />
            </label>

            <div className="flex gap-3">
              <button
                onClick={reset}
                className="inline-flex items-center justify-center gap-2 rounded-[12px] bg-af-card border border-af-border px-4 py-3 text-sm font-semibold text-af-ink hover:bg-af-bg transition"
              >
                {t("soilPh.discard")}
              </button>
              <button
                onClick={save}
                disabled={!phValid || saving}
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-[12px] bg-af-primary hover:bg-af-primary-deep text-white px-5 py-3 text-sm font-semibold transition active:scale-[0.98] shadow-af-sm disabled:opacity-50"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                {t("soilPh.save")}
              </button>
            </div>

            <p className="border-t border-af-border pt-3 text-[11px] leading-relaxed text-af-muted">
              {t("soilPh.caveat")}
            </p>
          </div>
        )}

        {saved && (
          <div className="h-full flex flex-col items-center justify-center text-center">
            <span className="flex items-center justify-center w-12 h-12 rounded-full bg-af-primary/10 text-af-primary-deep">
              <Check className="w-6 h-6" />
            </span>
            <p className="mt-3 text-sm font-semibold text-af-ink">{t("soilPh.saved")}</p>
          </div>
        )}
      </Card>
    </div>
  );
}
