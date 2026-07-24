"use client";

import { useRef, useState } from "react";
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
  X,
} from "lucide-react";

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

  function reset() {
    setPreview(null);
    setFile(null);
    setResult(null);
    setError(null);
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
        setError(data?.error ?? "Diagnosis failed. Please try again.");
      } else {
        setResult(data as DiseaseResult);
      }
    } catch {
      setError("Network error. Is the app online?");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Upload panel */}
      <div className="af-spotlight relative rounded-2xl bg-af-card border border-af-border shadow-af-sm p-6">
        <div className="flex items-center gap-2.5 mb-4">
          <span className="flex items-center justify-center w-9 h-9 rounded-xl bg-af-sage text-af-secondary">
            <ScanLine className="w-[18px] h-[18px]" />
          </span>
          <div>
            <h2 className="text-lg font-extrabold text-af-ink leading-tight">Upload a Leaf</h2>
            <p className="text-[13px] text-af-muted">A clear, close photo works best</p>
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
            <div className="mt-4 text-sm font-bold text-af-ink">Drop an image or click to browse</div>
            <div className="mt-1 text-[12px] text-af-muted">JPG / PNG · a single affected leaf</div>
          </button>
        ) : (
          <div className="relative">
            <img
              src={preview}
              alt="leaf preview"
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
                  <span className="inline-flex items-center gap-2 rounded-full bg-af-card px-4 py-2 text-sm font-bold text-af-ink shadow-af-md">
                    <Loader2 className="w-4 h-4 animate-spin text-af-primary" /> Analyzing…
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
              className="inline-flex items-center justify-center gap-2 rounded-[12px] bg-af-card border border-af-border px-4 py-3 text-sm font-bold text-af-ink hover:bg-af-bg transition"
            >
              <RefreshCw className="w-4 h-4" /> Change
            </button>
            <button
              onClick={analyze}
              disabled={loading}
              className="flex-1 inline-flex items-center justify-center gap-2 rounded-[12px] bg-af-primary hover:bg-af-primary-deep text-white px-5 py-3 text-sm font-bold transition active:scale-[0.98] shadow-af-sm disabled:opacity-50"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ScanLine className="w-4 h-4" />}
              {loading ? "Analyzing…" : "Diagnose Disease"}
            </button>
          </div>
        )}
      </div>

      {/* Result panel */}
      <div className="af-spotlight relative rounded-2xl bg-af-card border border-af-border shadow-af-sm p-6 min-h-[420px]">
        {!result && !error && (
          <div className="h-full flex flex-col items-center justify-center text-center py-10">
            <span className="flex items-center justify-center w-14 h-14 rounded-2xl bg-af-sage text-af-secondary">
              <Leaf className="w-7 h-7" />
            </span>
            <h3 className="mt-4 text-base font-bold text-af-ink">Diagnosis appears here</h3>
            <p className="mt-1 text-sm text-af-muted max-w-xs">
              Upload a leaf and run the scan. Our trained model identifies the disease; AI writes the
              treatment plan.
            </p>
          </div>
        )}

        {error && (
          <div className="flex items-start gap-2 rounded-[16px] bg-af-danger/8 border border-af-danger/20 px-4 py-3">
            <AlertTriangle className="w-4 h-4 text-af-danger mt-0.5 shrink-0" />
            <div className="text-sm text-af-ink-2">{error}</div>
          </div>
        )}

        {result && <ResultView r={result} />}
      </div>
    </div>
  );
}

function ResultView({ r }: { r: DiseaseResult }) {
  const sevTone =
    r.severity === "Low"
      ? "bg-af-primary/10 text-af-primary-deep"
      : r.severity === "Medium"
      ? "bg-af-amber/12 text-[#9a7100]"
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
          <h3 className="mt-1 text-2xl font-extrabold text-af-ink leading-tight">
            {r.healthy ? "Healthy" : r.disease}
          </h3>
        </div>
        {r.healthy ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-af-primary/10 text-af-primary-deep px-3 py-1.5 text-[11px] font-bold">
            <ShieldCheck className="w-3.5 h-3.5" /> No disease
          </span>
        ) : (
          <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-[11px] font-bold ${sevTone}`}>
            {r.severity} severity
          </span>
        )}
      </div>

      {/* meters */}
      <div className="grid grid-cols-2 gap-3">
        <Meter label="Confidence" value={conf} tone="ai" />
        <Meter label="Affected area" value={Math.round(r.affectedAreaPct)} tone={r.healthy ? "green" : "amber"} />
      </div>

      {r.summary && <p className="text-sm text-af-ink-2 leading-relaxed">{r.summary}</p>}

      {/* treatment */}
      {!r.healthy && (r.treatment.organic.length > 0 || r.treatment.chemical.length > 0) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <TreatBlock
            icon={<Leaf className="w-4 h-4 text-af-primary-deep" />}
            title="Organic"
            items={r.treatment.organic}
          />
          <TreatBlock
            icon={<FlaskConical className="w-4 h-4 text-af-ai" />}
            title="Chemical"
            items={r.treatment.chemical}
          />
        </div>
      )}

      {/* recovery + prevention */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {r.recovery && (
          <div className="rounded-[14px] bg-af-bg border border-af-border px-4 py-3">
            <div className="font-mono text-[10px] font-bold tracking-[0.16em] uppercase text-af-muted">
              Recovery
            </div>
            <div className="mt-1 text-sm font-semibold text-af-ink">{r.recovery}</div>
          </div>
        )}
        {r.prevention?.length > 0 && (
          <div className="rounded-[14px] bg-af-bg border border-af-border px-4 py-3">
            <div className="font-mono text-[10px] font-bold tracking-[0.16em] uppercase text-af-muted">
              Prevention
            </div>
            <ul className="mt-1 text-[13px] text-af-ink-2 leading-relaxed list-disc pl-4 space-y-0.5">
              {r.prevention.slice(0, 3).map((p, i) => (
                <li key={i}>{p}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* source note */}
      <div className="flex items-center gap-1.5 text-[11px] text-af-muted pt-1">
        {r.source === "model" ? (
          <ScanLine className="w-3.5 h-3.5 text-af-primary" />
        ) : (
          <Sparkles className="w-3.5 h-3.5 text-af-ai" />
        )}
        {r.note ?? (r.source === "model" ? "Trained model" : "AI vision")}
      </div>
    </div>
  );
}

function Meter({ label, value, tone }: { label: string; value: number; tone: "ai" | "green" | "amber" }) {
  const bar =
    tone === "ai" ? "bg-af-ai" : tone === "green" ? "bg-af-primary" : "bg-af-amber";
  return (
    <div className="rounded-[14px] bg-af-bg border border-af-border px-4 py-3">
      <div className="flex items-center justify-between">
        <span className="font-mono text-[10px] font-bold tracking-[0.16em] uppercase text-af-muted">
          {label}
        </span>
        <span className="font-mono text-sm font-bold text-af-ink">{value}%</span>
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
        <span className="text-[13px] font-bold text-af-ink">{title}</span>
      </div>
      <ul className="text-[13px] text-af-ink-2 leading-relaxed list-disc pl-4 space-y-0.5">
        {items.slice(0, 4).map((t, i) => (
          <li key={i}>{t}</li>
        ))}
      </ul>
    </div>
  );
}
