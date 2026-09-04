"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Card from "@/components/ui/Card";
import {
  Upload,
  ScanLine,
  Leaf,
  Loader2,
  ShieldCheck,
  AlertTriangle,
  Sprout,
  FlaskConical,
  Sparkles,
  RefreshCw,
  MapPin,
  ArrowRight,
  X,
} from "lucide-react";
import { useT } from "@/components/i18n/LanguageProvider";

type DiseaseResult = {
  source: "model" | "vision";
  crop: string;
  disease: string;
  healthy: boolean;
  confidence: number;
  severity: "Low" | "Medium" | "High";
  affectedAreaPct: number;
  summary: string;
  treatment: { organic: string[]; chemical: string[] };
  recovery: string;
  prevention: string[];
  note?: string;
};

export default function DiseaseScanner() {
  const router = useRouter();
  const { t } = useT();
  const [preview, setPreview] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<DiseaseResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function pick(f: File | null | undefined) {
    if (!f) return;
    setFile(f);
    setResult(null);
    setError(null);
    setPreview(URL.createObjectURL(f));
  }

  /**
   * Clearing the scan is also when the history below is refreshed.
   *
   * This used to call `router.refresh()` the moment a result arrived, to pick
   * up the new row in "Recent Scans". That was harmless for months and then
   * quietly became a bug: a dashboard `template.tsx` now wraps every page, and
   * `router.refresh()` rebuilds the router cache from the root, tearing that
   * wrapper down and recreating it. The diagnosis went with it — the farmer
   * saw treatment steps for about a second and then an empty panel.
   *
   * (The giveaway was the page-entry animation replaying. A re-render cannot
   * restart a CSS animation, so that element was definitely being recreated.)
   *
   * Refreshing here instead means it never fires while a result is on screen,
   * which holds regardless of exactly which boundary is doing the tearing. The
   * history list sits below the fold and gaining a row is not something anyone
   * is waiting on, so deferring it to the reset costs nothing.
   */
  function reset() {
    setPreview(null);
    setFile(null);
    setResult(null);
    setError(null);
    router.refresh();
  }

  async function analyze() {
    if (!file) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const fd = new FormData();
      fd.append("image", file);
      const res = await fetch("/api/disease", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error ?? t("diseaseScanner.diagnosisFailed"));
      } else {
        setResult(data as DiseaseResult);
      }
    } catch {
      setError(t("diseaseScanner.networkError"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Upload panel */}
      <Card className="p-6">
        <div className="flex items-center gap-2.5 mb-4">
          <span className="flex items-center justify-center w-9 h-9 rounded-xl bg-af-sage text-af-secondary">
            <ScanLine className="w-[18px] h-[18px]" />
          </span>
          <div>
            <h2 className="text-[17px] font-semibold tracking-[-0.02em] text-af-ink leading-tight">{t("diseaseScanner.uploadTitle")}</h2>
            <p className="text-meta text-af-muted">{t("diseaseScanner.uploadSubtitle")}</p>
          </div>
        </div>

        {!preview ? (
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
              dragging ? "border-af-primary bg-af-primary/5" : "border-af-border bg-af-bg hover:border-af-primary/40"
            }`}
          >
            <span className="flex items-center justify-center w-14 h-14 rounded-2xl bg-af-primary/10 text-af-primary-deep">
              <Upload className="w-6 h-6" />
            </span>
            <div className="mt-4 text-sm font-semibold text-af-ink">{t("diseaseScanner.dragDrop")}</div>
            <div className="mt-1 text-[12px] text-af-muted">{t("diseaseScanner.fileHint")}</div>
          </button>
        ) : (
          <div className="relative">
            <img
              src={preview}
              alt={t("diseaseScanner.leafPreviewAlt")}
              className="w-full h-[300px] object-cover rounded-2xl border border-af-border"
            />
            <button
              onClick={reset}
              className="absolute top-3 right-3 flex items-center justify-center w-8 h-8 rounded-full bg-af-ink/70 text-white hover:bg-af-ink transition"
            >
              <X className="w-4 h-4" />
            </button>
            {loading && (
              <div className="absolute inset-0 rounded-2xl bg-af-ink/25 backdrop-blur-[1px] overflow-hidden">
                <div className="absolute inset-x-0 h-16 bg-gradient-to-b from-af-primary/0 via-af-primary/40 to-af-primary/0 animate-hud-scan" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="inline-flex items-center gap-2 rounded-full bg-af-card px-4 py-2 text-sm font-semibold text-af-ink shadow-af-md">
                    <Loader2 className="w-4 h-4 animate-spin text-af-primary" /> {t("diseaseScanner.analyzing")}
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => pick(e.target.files?.[0])}
        />

        {preview && (
          <div className="mt-4 flex gap-3">
            <button
              onClick={reset}
              className="inline-flex items-center justify-center gap-2 rounded-[12px] bg-af-card border border-af-border px-4 py-3 text-sm font-semibold text-af-ink hover:bg-af-bg transition"
            >
              <RefreshCw className="w-4 h-4" /> {t("diseaseScanner.change")}
            </button>
            <button
              onClick={analyze}
              disabled={loading}
              className="flex-1 inline-flex items-center justify-center gap-2 rounded-[12px] bg-af-primary hover:bg-af-primary-deep text-white px-5 py-3 text-sm font-semibold transition active:scale-[0.98] shadow-af-sm disabled:opacity-50"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ScanLine className="w-4 h-4" />}
              {loading ? t("diseaseScanner.analyzing") : t("diseaseScanner.diagnose")}
            </button>
          </div>
        )}
      </Card>

      {/* Result panel */}
      <Card className="p-6 min-h-[420px]">
        {!result && !error && <HowItWorks />}

        {error && (
          <div className="flex items-start gap-2 rounded-[16px] bg-af-danger/10 border border-af-danger/20 px-4 py-3">
            <AlertTriangle className="w-4 h-4 text-af-danger mt-0.5 shrink-0" />
            <div className="text-sm text-af-ink-2">{error}</div>
          </div>
        )}

        {result && <ResultView r={result} />}
      </Card>
    </div>
  );
}

const STEPS = [
  { titleKey: "diseaseScanner.step1Title", bodyKey: "diseaseScanner.step1Body" },
  { titleKey: "diseaseScanner.step2Title", bodyKey: "diseaseScanner.step2Body" },
  { titleKey: "diseaseScanner.step3Title", bodyKey: "diseaseScanner.step3Body" },
];

/** Empty state for the result panel — explains the flow before the first scan. */
function HowItWorks() {
  const { t } = useT();
  return (
    // The page backdrop already carries the botanical/circuit motif, so this
    // panel stays clean rather than stacking a second illustration on top.
    <div className="h-full">
      <h3 className="text-lg font-semibold text-af-primary-deep tracking-tight">{t("diseaseScanner.howItWorks")}</h3>

      <ol className="mt-6 space-y-7">
        {STEPS.map((s, i) => (
          <li key={s.titleKey} className="flex items-start gap-3.5">
            <span className="relative flex flex-col items-center shrink-0">
              <span className="flex items-center justify-center w-7 h-7 rounded-full bg-af-sage text-af-primary-deep font-mono text-[11px] font-semibold">
                {i + 1}
              </span>
              {i < STEPS.length - 1 && (
                <span className="absolute top-8 h-[calc(100%+1rem)] w-px border-l border-dashed border-af-border" />
              )}
            </span>
            <div className="min-w-0 pt-0.5">
              <div className="text-[15px] font-semibold text-af-ink leading-tight">{t(s.titleKey)}</div>
              <div className="mt-1 text-meta text-af-ink-2">{t(s.bodyKey)}</div>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

function ResultView({ r }: { r: DiseaseResult }) {
  const { t } = useT();
  const sevTone =
    r.severity === "Low"
      ? "bg-af-primary/10 text-af-primary-deep"
      : r.severity === "Medium"
      ? "bg-af-amber/10 text-af-amber-ink"
      : "bg-af-danger/10 text-af-danger";
  const conf = Math.round(r.confidence * 100);

  return (
    <div className="space-y-5">
      {/* header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-[12px] text-af-muted font-semibold">
            <Sprout className="w-3.5 h-3.5 text-af-primary" />
            {r.crop}
          </div>
          <h3 className="mt-1 text-2xl font-semibold text-af-ink leading-tight">
            {r.healthy ? t("diseaseScanner.healthy") : r.disease}
          </h3>
        </div>
        {r.healthy ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-af-primary/10 text-af-primary-deep px-3 py-1.5 text-[11px] font-semibold">
            <ShieldCheck className="w-3.5 h-3.5" /> {t("diseaseScanner.noDisease")}
          </span>
        ) : (
          <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-[11px] font-semibold ${sevTone}`}>
            {t("diseaseScanner.severitySuffix", { severity: r.severity })}
          </span>
        )}
      </div>

      {/* meters */}
      <div className="grid grid-cols-2 gap-3">
        <Meter label={t("diseaseScanner.confidence")} value={conf} tone="ai" />
        <Meter label={t("diseaseScanner.affectedArea")} value={Math.round(r.affectedAreaPct)} tone={r.healthy ? "green" : "amber"} />
      </div>

      {r.summary && <p className="text-sm text-af-ink-2 leading-relaxed">{r.summary}</p>}

      {/* treatment */}
      {!r.healthy && (r.treatment.organic.length > 0 || r.treatment.chemical.length > 0) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <TreatBlock
            icon={<Leaf className="w-4 h-4 text-af-primary-deep" />}
            title={t("diseaseScanner.organic")}
            items={r.treatment.organic}
          />
          <TreatBlock
            icon={<FlaskConical className="w-4 h-4 text-af-ai" />}
            title={t("diseaseScanner.chemical")}
            items={r.treatment.chemical}
          />
        </div>
      )}

      {/* Where to actually get it.

          The scanner tells a farmer to buy neem oil or a fungicide and then
          stops; until now nothing in the app connected "you need this" to
          "here is where it is sold", and the locator was reachable only from
          the sidebar. Shown on the same condition as the treatment blocks, so
          it never appears on a healthy leaf.

          The link is deliberately generic. Treatment steps are free prose -
          there is no product field, no active ingredient, no dose - and the
          locator lists shops around the farmer rather than searching them, so
          there is nothing truthful to deep-link with. */}
      {!r.healthy && (r.treatment.organic.length > 0 || r.treatment.chemical.length > 0) && (
        <Link
          href="/dashboard/store-locator"
          className="group flex items-center justify-between gap-3 rounded-[14px] border border-af-primary/20 bg-af-primary/[0.06] px-4 py-3 transition hover:border-af-primary/40 hover:bg-af-primary/10 outline-none focus-visible:ring-2 focus-visible:ring-af-primary/40"
        >
          <span className="flex items-center gap-2.5 min-w-0">
            <MapPin className="w-4 h-4 shrink-0 text-af-primary-deep" />
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-af-ink">
                {t("diseaseScanner.findInShop")}
              </span>
              <span className="block text-meta text-af-ink-2">
                {t("diseaseScanner.findInShopSub")}
              </span>
            </span>
          </span>
          <ArrowRight className="w-4 h-4 shrink-0 text-af-primary-deep transition-transform group-hover:translate-x-0.5" />
        </Link>
      )}

      {/* recovery + prevention */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {r.recovery && (
          <div className="rounded-[14px] bg-af-bg border border-af-border px-4 py-3">
            <div className="font-mono text-[10px] font-semibold tracking-[0.16em] uppercase text-af-muted">
              {t("diseaseScanner.recovery")}
            </div>
            <div className="mt-1 text-sm font-semibold text-af-ink">{r.recovery}</div>
          </div>
        )}
        {r.prevention?.length > 0 && (
          <div className="rounded-[14px] bg-af-bg border border-af-border px-4 py-3">
            <div className="font-mono text-[10px] font-semibold tracking-[0.16em] uppercase text-af-muted">
              {t("diseaseScanner.prevention")}
            </div>
            <ul className="mt-1 text-meta text-af-ink-2 leading-relaxed list-disc pl-4 space-y-0.5">
              {r.prevention.slice(0, 3).map((p, i) => (
                <li key={i}>{p}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* A diagnosis the model itself is unsure about should not be acted on as
          though it were certain. Below the same threshold the API uses to fall
          back to vision, say so plainly rather than leaving the farmer to
          interpret a percentage. */}
      {conf < 60 && (
        <div className="flex items-start gap-2 rounded-[14px] border border-af-amber/25 bg-af-amber/10 px-4 py-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-af-amber-ink" />
          <div className="text-sm text-af-ink-2 leading-relaxed">
            <span className="font-semibold text-af-ink">{t("diseaseScanner.uncertainDiagnosis", { conf })}</span>{" "}
            {t("diseaseScanner.confirmOfficer")}
          </div>
        </div>
      )}

      {/* source note */}
      <div className="flex items-center gap-1.5 text-[11px] text-af-muted pt-1">
        {r.source === "model" ? (
          <ScanLine className="w-3.5 h-3.5 text-af-primary" />
        ) : (
          <Sparkles className="w-3.5 h-3.5 text-af-ai" />
        )}
        {r.note ?? (r.source === "model" ? t("diseaseScanner.trainedModel") : t("diseaseScanner.aiVision"))}
      </div>

      {/* Standing disclaimer. The scanner recommends spending money on chemicals
          and can be wrong, so this is shown on every result, confident or not. */}
      <p className="border-t border-af-border pt-3 text-[11px] leading-relaxed text-af-muted">
        {t("diseaseScanner.disclaimer")}
      </p>
    </div>
  );
}

function Meter({ label, value, tone }: { label: string; value: number; tone: "ai" | "green" | "amber" }) {
  const bar =
    tone === "ai" ? "bg-af-ai" : tone === "green" ? "bg-af-primary" : "bg-af-amber";
  return (
    <div className="rounded-[14px] bg-af-bg border border-af-border px-4 py-3">
      <div className="flex items-center justify-between">
        <span className="font-mono text-[10px] font-semibold tracking-[0.16em] uppercase text-af-muted">
          {label}
        </span>
        <span className="font-mono text-sm font-semibold text-af-ink">{value}%</span>
      </div>
      <div className="mt-2 h-1.5 w-full rounded-full bg-af-border overflow-hidden">
        <div className={`h-full rounded-full ${bar}`} style={{ width: `${Math.min(100, value)}%` }} />
      </div>
    </div>
  );
}

function TreatBlock({ icon, title, items }: { icon: React.ReactNode; title: string; items: string[] }) {
  if (!items || items.length === 0) return null;
  return (
    <div className="rounded-[14px] bg-af-bg border border-af-border px-4 py-3">
      <div className="flex items-center gap-1.5 mb-1.5">
        {icon}
        <span className="text-meta font-semibold text-af-ink">{title}</span>
      </div>
      <ul className="text-meta text-af-ink-2 leading-relaxed list-disc pl-4 space-y-0.5">
        {items.slice(0, 4).map((t, i) => (
          <li key={i}>{t}</li>
        ))}
      </ul>
    </div>
  );
}
