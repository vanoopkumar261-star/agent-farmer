"use client";

import { useState } from "react";
import { Loader2, Sprout, ChevronRight } from "lucide-react";
import Card from "@/components/ui/Card";
import { useT } from "@/components/i18n/LanguageProvider";
import { phBand } from "@/lib/soilPh";
import type { CropRec } from "@/components/onboarding/CropRecCard";

type FarmIn = { area: number; soilType: string; irrigation: string; farm_index: number };

export default function SoilCropFit({
  address,
  preferOilseed,
  latestPh,
  farms,
}: {
  address: string;
  preferOilseed: boolean;
  latestPh: number;
  farms: FarmIn[];
}) {
  const { t } = useT();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CropRec[][] | null>(null);
  const band = phBand(latestPh);

  async function run() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/recommendations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          locationAddress: address,
          preferOilseed,
          farms: farms.map((f) => ({
            area: f.area,
            soilType: f.soilType,
            irrigation: f.irrigation,
            soilPh: latestPh,
          })),
        }),
      });
      if (!res.ok) {
        setError(t("soilPh.cropFitError"));
        return;
      }
      const data = await res.json();
      setResult((data?.farms ?? []) as CropRec[][]);
    } catch {
      setError(t("soilPh.cropFitError"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-8">
      {!result && (
        <button
          onClick={run}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-[12px] bg-af-card border border-af-border px-5 py-3 text-sm font-semibold text-af-ink hover:border-af-primary/40 transition disabled:opacity-50"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sprout className="w-4 h-4 text-af-primary" />}
          {loading ? t("soilPh.cropFitLoading") : t("soilPh.cropFitButton")}
        </button>
      )}

      {error && <p className="mt-3 text-sm text-af-danger">{error}</p>}

      {result && (
        <div className="space-y-4">
          <h3 className="text-[15px] font-semibold text-af-ink">
            {t("soilPh.cropFitTitle", { ph: latestPh.toFixed(1) })}
            <span className="ml-2 text-[12px] font-normal" style={{ color: band.color }}>
              {t(`soilPh.band.${band.key}.label`)}
            </span>
          </h3>
          {result.map((farmRecs, fi) => (
            <Card key={fi} className="p-4">
              <div className="font-mono text-[10px] font-semibold tracking-[0.16em] uppercase text-af-muted mb-2">
                Farm {farms[fi]?.farm_index ?? fi + 1}
              </div>
              <ul className="divide-y divide-af-border/60">
                {farmRecs.slice(0, 3).map((rec, i) => (
                  <li key={i} className="py-2.5 flex items-start gap-3">
                    <ChevronRight className="w-4 h-4 text-af-primary mt-0.5 shrink-0" />
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-af-ink">
                        {rec.cropName}
                        <span className="ml-2 text-[12px] font-normal text-af-muted">
                          {rec.suitabilityScore}/100 · {rec.riskScore} risk
                        </span>
                      </div>
                      {rec.pros?.[0] && (
                        <p className="mt-0.5 text-meta text-af-ink-2 leading-relaxed line-clamp-2">
                          {rec.pros[0]}
                          {rec.cons?.[0] ? ` — ${rec.cons[0]}` : ""}
                        </p>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
