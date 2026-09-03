"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  Info,
  Loader2,
  MapPin,
  ShieldAlert,
  X,
} from "lucide-react";
import { useT } from "@/components/i18n/LanguageProvider";
import DistrictSeverityMap from "./DistrictSeverityMap";
import type { GeoJsonGeometry } from "@/lib/hazards/geometry";
import type { SeverityKey } from "@/lib/chartTheme";

/**
 * "Is there an emergency over my land right now?"
 *
 * Opens from the Alerts card, asks /api/hazards/check, and shows what official
 * warnings — IMD, CWC, the state SDMA — are in force over the farmer's own
 * district.
 *
 * Two rules shape everything here:
 *
 *  1. The app is never the authority. Every warning names the agency that
 *     issued it, quotes that agency's instruction verbatim, and links out to
 *     SACHET. Nothing is paraphrased or translated — a government safety
 *     instruction rendered through machine translation is worse than none.
 *  2. An empty answer is a real answer. "Nothing over you" is the outcome the
 *     farmer wants, so it gets a confident green panel naming the district and
 *     the data time, not a grey "no results" that reads like a broken screen.
 */

type MatchedAlert = {
  band: "red" | "orange" | "yellow";
  event: string;
  severity: string;
  certainty: string | null;
  urgency: string | null;
  headline: string;
  instruction: string | null;
  sender: string | null;
  onset: string | null;
  expires: string | null;
  matchedOn: "district" | "state";
};

type CheckResult = {
  district: string | null;
  state: string | null;
  outline: { district: string; state: string | null; geojson: GeoJsonGeometry } | null;
  home: { lat: number; lng: number } | null;
  checkedAt: string;
  freshness: "live" | "cached";
  dataAsOf: string | null;
  red: MatchedAlert[];
  orange: MatchedAlert[];
  yellow: MatchedAlert[];
  reason?: "no-location";
};

const BAND = {
  red: {
    wrap: "border-af-danger/45 bg-af-danger/10",
    chip: "bg-af-danger text-white",
    icon: "text-af-danger",
    Icon: ShieldAlert,
  },
  orange: {
    wrap: "border-af-amber/45 bg-af-amber/10",
    chip: "bg-af-amber text-af-amber-ink",
    icon: "text-af-amber-ink",
    Icon: AlertTriangle,
  },
  yellow: {
    wrap: "border-af-border bg-af-bg",
    chip: "bg-af-bg text-af-ink-2 border border-af-border",
    icon: "text-af-muted",
    Icon: Info,
  },
} as const;

/** IST, because every one of these warnings is issued and timed in IST. */
function istTime(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("en-IN", {
      timeZone: "Asia/Kolkata",
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  } catch {
    return "—";
  }
}

function AlertBlock({ alert }: { alert: MatchedAlert }) {
  const { t } = useT();
  const cfg = BAND[alert.band];
  const Icon = cfg.Icon;

  return (
    <div className={`rounded-xl border px-4 py-3.5 ${cfg.wrap}`}>
      <div className="flex items-start gap-3">
        <Icon className={`w-[18px] h-[18px] mt-0.5 shrink-0 ${cfg.icon}`} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-af-ink">{alert.event}</span>
            <span
              className={`font-mono text-[10px] font-bold tracking-[0.12em] uppercase rounded px-1.5 py-0.5 ${cfg.chip}`}
            >
              {t(`hazardCheck.band${alert.band[0].toUpperCase()}${alert.band.slice(1)}`)}
            </span>
            {alert.matchedOn === "state" && (
              <span className="text-[10px] text-af-muted">{t("hazardCheck.matchedState")}</span>
            )}
          </div>

          {/* The agency's own words. Never translated, never rewritten. */}
          <p className="text-[13px] text-af-ink-2 mt-1.5 leading-relaxed" lang="en">
            {alert.headline}
          </p>

          {alert.instruction && (
            <div className="mt-2.5 rounded-lg bg-af-card/70 border border-af-border px-3 py-2">
              <div className="font-mono text-[9px] font-semibold tracking-[0.16em] uppercase text-af-muted">
                {t("hazardCheck.instruction")}
              </div>
              <p className="text-[12px] text-af-ink mt-1 leading-relaxed" lang="en">
                {alert.instruction}
              </p>
            </div>
          )}

          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2.5 text-[11px] text-af-muted">
            {alert.sender && <span>{t("hazardCheck.issuedBy", { sender: alert.sender })}</span>}
            <span>{t("hazardCheck.validUntil", { time: istTime(alert.expires) })}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function Section({
  titleKey,
  alerts,
  emphasised,
}: {
  titleKey: string;
  alerts: MatchedAlert[];
  emphasised?: boolean;
}) {
  const { t } = useT();
  if (alerts.length === 0) return null;

  return (
    <div
      className={
        emphasised
          ? "rounded-2xl border-2 border-af-danger/40 bg-af-danger/[0.04] p-4"
          : undefined
      }
    >
      <div
        className={`font-mono text-[10px] font-bold tracking-[0.18em] uppercase mb-2.5 ${
          emphasised ? "text-af-danger" : "text-af-muted"
        }`}
      >
        {t(titleKey)}
      </div>
      <div className="space-y-2.5">
        {alerts.map((a, i) => (
          <AlertBlock key={i} alert={a} />
        ))}
      </div>
    </div>
  );
}

export default function HazardCheckModal({ onClose }: { onClose: () => void }) {
  const { t } = useT();
  const [result, setResult] = useState<CheckResult | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);

  const run = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await fetch("/api/hazards/check", { method: "POST" });
      if (!res.ok) throw new Error(String(res.status));
      setResult((await res.json()) as CheckResult);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  // The search starts the moment the popup opens — the farmer asked a question
  // by tapping the button, so making them press "search" again would be a
  // second tap for no information.
  useEffect(() => {
    run();
  }, [run]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  const high = (result?.red.length ?? 0) + (result?.orange.length ?? 0);
  const nothing = result && high === 0 && result.yellow.length === 0 && !result.reason;
  const onlyYellow = result && high === 0 && result.yellow.length > 0;

  // Highest band in force drives the map. Derived from the bands the server
  // already computed — never re-derived from severity strings here, so the
  // picture and the list can never disagree.
  const mapBand: SeverityKey = !result
    ? "clear"
    : result.red.length > 0
      ? "red"
      : result.orange.length > 0
        ? "orange"
        : result.yellow.length > 0
          ? "yellow"
          : "clear";
  const mapCount =
    mapBand === "red"
      ? (result?.red.length ?? 0)
      : mapBand === "orange"
        ? (result?.orange.length ?? 0)
        : mapBand === "yellow"
          ? (result?.yellow.length ?? 0)
          : 0;

  const body = (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-af-ink/40 backdrop-blur-sm px-4 py-8"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={t("hazardCheck.title")}
    >
      <div
        className="w-full max-w-2xl rounded-2xl bg-af-card border border-af-border shadow-af-float"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 px-6 pt-5 pb-4 border-b border-af-border">
          <div>
            <div className="text-base font-semibold text-af-ink">{t("hazardCheck.title")}</div>
            {result?.district && (
              <div className="flex items-center gap-1.5 text-[12px] text-af-muted mt-1">
                <MapPin className="w-3.5 h-3.5" />
                {t("hazardCheck.checkedFor", { district: result.district })}
              </div>
            )}
          </div>
          <button
            onClick={onClose}
            aria-label={t("hazardCheck.close")}
            className="shrink-0 w-8 h-8 rounded-lg border border-af-border text-af-ink-2 hover:text-af-ink hover:border-af-primary/30 inline-flex items-center justify-center transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          {loading && (
            <div className="flex items-center gap-3 py-10 justify-center text-af-ink-2">
              <Loader2 className="w-5 h-5 animate-spin text-af-primary" />
              <span className="text-sm">
                {result?.district
                  ? t("hazardCheck.searching", { district: result.district })
                  : t("hazardCheck.searchingGeneric")}
              </span>
            </div>
          )}

          {!loading && error && (
            <div className="py-8 text-center">
              <p className="text-sm text-af-ink-2">{t("hazardCheck.error")}</p>
              <button
                onClick={run}
                className="mt-3 rounded-lg border border-af-border px-3.5 py-1.5 text-[13px] font-medium text-af-ink hover:border-af-primary/40 transition"
              >
                {t("hazardCheck.retry")}
              </button>
            </div>
          )}

          {!loading && !error && result?.reason === "no-location" && (
            <div className="rounded-xl border border-af-border bg-af-bg px-4 py-5 text-center">
              <MapPin className="w-6 h-6 mx-auto text-af-muted" />
              <div className="text-sm font-semibold text-af-ink mt-2">
                {t("hazardCheck.noLocationTitle")}
              </div>
              <p className="text-[12px] text-af-ink-2 mt-1">{t("hazardCheck.noLocationBody")}</p>
            </div>
          )}

          {!loading && !error && result && !result.reason && (
            <>
              {/* The answer as a picture, before the answer as prose. */}
              <DistrictSeverityMap
                district={result.district}
                geojson={result.outline?.geojson ?? null}
                home={result.home}
                band={mapBand}
                count={mapCount}
              />

              {/* The all-clear is a confident answer, not an empty state. */}
              {(nothing || onlyYellow) && (
                <div className="rounded-xl border border-af-primary/30 bg-af-primary/[0.07] px-4 py-5 text-center">
                  <CheckCircle2 className="w-7 h-7 mx-auto text-af-primary-deep" />
                  <div className="text-sm font-semibold text-af-ink mt-2">
                    {t("hazardCheck.noneTitle")}
                  </div>
                  <p className="text-[12.5px] text-af-ink-2 mt-1">{t("hazardCheck.noneBody")}</p>
                </div>
              )}

              <Section titleKey="hazardCheck.redSection" alerts={result.red} emphasised />
              <Section titleKey="hazardCheck.orangeSection" alerts={result.orange} />
              <Section titleKey="hazardCheck.yellowSection" alerts={result.yellow} />
            </>
          )}
        </div>

        {!loading && !error && result && (
          <div className="px-6 py-3.5 border-t border-af-border space-y-1.5">
            <p className="text-[11px] text-af-muted leading-relaxed">
              {t("hazardCheck.disclaimer")}
            </p>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-[11px] text-af-muted">
                {t("hazardCheck.dataAsOf", { time: istTime(result.dataAsOf ?? result.checkedAt) })}
              </span>
              <a
                href="https://sachet.ndma.gov.in/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[11px] font-medium text-af-primary-deep hover:underline"
              >
                NDMA SACHET
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  if (typeof document === "undefined") return null;
  return createPortal(body, document.body);
}
