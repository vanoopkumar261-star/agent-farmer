"use client";

import { useState, useEffect } from "react";
import {
  X, Truck, Package, Calculator,
  CheckCircle, AlertTriangle, TrendingUp,
} from "lucide-react";
import type { MandiRow } from "@/lib/market";
import { useT } from "@/components/i18n/LanguageProvider";

const rupee = (n: number) => `₹${Number(n).toLocaleString("en-IN")}`;

const VEHICLES = [
  {
    id: "tata_ace",
    name: "Tata Ace (Chota Hathi)",
    capacity: 8,
    ratePerKm: 15,
    minCharge: 400,
    descKey: "transportPlanner.vehicle.tata_ace.desc",
    icon: "🛻",
  },
  {
    id: "bolero_pickup",
    name: "Mahindra Bolero Pickup",
    capacity: 15,
    ratePerKm: 22,
    minCharge: 700,
    descKey: "transportPlanner.vehicle.bolero_pickup.desc",
    icon: "🚐",
  },
  {
    id: "tata_407",
    name: "Tata 407 (Medium Truck)",
    capacity: 35,
    ratePerKm: 35,
    minCharge: 1500,
    descKey: "transportPlanner.vehicle.tata_407.desc",
    icon: "🚚",
  },
  {
    id: "eicher_pro",
    name: "Eicher Pro (10-Tonne)",
    capacity: 100,
    ratePerKm: 60,
    minCharge: 3500,
    descKey: "transportPlanner.vehicle.eicher_pro.desc",
    icon: "🚛",
  },
  {
    id: "ashok_leyland",
    name: "Ashok Leyland (Multi-axle)",
    capacity: 250,
    ratePerKm: 110,
    minCharge: 7000,
    descKey: "transportPlanner.vehicle.ashok_leyland.desc",
    icon: "🚜",
  },
];

const IS_ROUND_TRIP = true;

function calcVehicleCost(vehicle: typeof VEHICLES[0], distanceKm: number, weight: number) {
  const tripsNeeded = Math.ceil(weight / vehicle.capacity);
  const chargedDistance = IS_ROUND_TRIP ? distanceKm * 2 : distanceKm;
  const tripCost = Math.max(vehicle.minCharge, chargedDistance * vehicle.ratePerKm);
  const totalCost = Math.round(tripCost * tripsNeeded);
  return { tripsNeeded, totalCost };
}

export default function TransportPlanner({
  mandi,
  cropName,
  onClose,
}: {
  mandi: MandiRow;
  cropName: string;
  onClose: () => void;
}) {
  const { t } = useT();
  const [weight, setWeight] = useState(50);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);

  // Calculate costs for all vehicles
  const vehiclesWithCost = VEHICLES.map((v) => {
    const { tripsNeeded, totalCost } = calcVehicleCost(v, mandi.distanceKm, weight);
    return { ...v, tripsNeeded, totalCost };
  });

  // Find recommended (lowest total cost)
  const recommended = vehiclesWithCost.reduce((a, b) =>
    a.totalCost < b.totalCost ? a : b
  );

  const activeVehicleId = selectedVehicleId ?? recommended.id;
  const activeVehicle = vehiclesWithCost.find((v) => v.id === activeVehicleId)!;

  const grossRevenue = Math.round(mandi.netPrice * weight);
  const finalEarnings = Math.max(0, grossRevenue - activeVehicle.totalCost);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative z-10 w-full max-w-xl max-h-[90vh] flex flex-col rounded-[28px] bg-af-card border border-af-border shadow-af-float overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-af-border shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-af-sage">
              <Truck className="w-5 h-5 text-af-secondary" />
            </div>
            <div>
              <h2 className="font-sans text-lg font-extrabold text-af-ink">
                {t("transportPlanner.title")}
              </h2>
              <p className="font-mono text-[10px] font-bold tracking-[0.18em] uppercase text-af-muted">
                {cropName} · {mandi.mandi}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex items-center justify-center w-9 h-9 rounded-xl bg-af-bg border border-af-border text-af-muted hover:text-af-ink hover:border-af-primary/40 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto px-6 py-5 space-y-5">

          {/* Mandi summary */}
          <div className="flex items-center justify-between rounded-[16px] bg-af-bg border border-af-border px-4 py-3">
            <div>
              <div className="text-sm font-bold text-af-ink">{mandi.mandi}</div>
              <div className="text-[12px] text-af-muted mt-0.5">
                {t("transportPlanner.distanceVerified", { km: mandi.distanceKm })}
              </div>
            </div>
            <div className="text-right">
              <div className="font-mono text-[11px] text-af-muted uppercase tracking-wide">
                {t("transportPlanner.netAtGate")}
              </div>
              <div className="font-mono text-lg font-extrabold text-af-primary">
                {rupee(mandi.netPrice)}/qtl
              </div>
            </div>
          </div>

          {/* Harvest weight input */}
          <div className="space-y-2">
            <label className="font-mono text-[10px] font-bold tracking-[0.18em] uppercase text-af-muted">
              {t("transportPlanner.harvestQty")}
            </label>
            <div className="flex items-center gap-3">
              <input
                type="number"
                min={1}
                step={0.5}
                value={weight}
                onChange={(e) => {
                  const v = parseFloat(e.target.value);
                  if (!isNaN(v) && v > 0) setWeight(v);
                }}
                className="w-full rounded-[14px] bg-af-bg border border-af-border px-4 py-3 text-sm font-bold text-af-ink outline-none focus:ring-2 focus:ring-af-primary/25 focus:border-af-primary/40 transition font-mono"
              />
              <div className="shrink-0 rounded-[14px] bg-af-sage border border-af-border px-4 py-3 text-sm font-bold text-af-secondary">
                {t("transportPlanner.quintals")}
              </div>
            </div>
            <p className="text-[11px] text-af-muted">
              {t("transportPlanner.qtlNote", { qtl: weight, tonnes: (weight / 10).toFixed(1) })}
            </p>
          </div>

          {/* Vehicle selection */}
          <div className="space-y-2">
            <label className="font-mono text-[10px] font-bold tracking-[0.18em] uppercase text-af-muted">
              {t("transportPlanner.selectVehicle")}
            </label>
            <p className="text-[11px] text-af-muted -mt-1">
              {t("transportPlanner.aiRecommends")}
            </p>
            <div className="space-y-2">
              {vehiclesWithCost.map((v) => {
                const isSelected = v.id === activeVehicleId;
                const isRec = v.id === recommended.id;
                const isOverloaded = weight > v.capacity;

                return (
                  <button
                    key={v.id}
                    onClick={() => setSelectedVehicleId(v.id)}
                    className={`w-full text-left rounded-[16px] border p-3.5 transition-all relative overflow-hidden ${
                      isSelected
                        ? "border-af-primary/50 bg-af-primary/[0.04] ring-2 ring-af-primary/15"
                        : "border-af-border bg-af-bg hover:border-af-primary/30"
                    }`}
                  >
                    {/* Recommended badge */}
                    {isRec && (
                      <span className="absolute top-0 right-0 rounded-bl-[12px] bg-af-secondary px-2 py-0.5 text-[9px] font-bold font-mono tracking-[0.15em] uppercase text-af-bg">
                        {t("transportPlanner.recommended")}
                      </span>
                    )}

                    <div className="flex items-center gap-3 pr-20">
                      <span className="text-2xl">{v.icon}</span>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-bold text-af-ink">{v.name}</div>
                        <div className="text-[11px] text-af-muted">{t(v.descKey)}</div>
                      </div>
                    </div>

                    <div className="mt-2.5 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="inline-flex items-center rounded-full bg-af-bg border border-af-border px-2 py-0.5 text-[10px] font-bold text-af-muted">
                          {t("transportPlanner.cap", { n: v.capacity })}
                        </span>
                        <span className="inline-flex items-center rounded-full bg-af-bg border border-af-border px-2 py-0.5 text-[10px] font-bold text-af-muted">
                          ₹{v.ratePerKm}/km
                        </span>
                        {v.tripsNeeded > 1 && (
                          <span className="inline-flex items-center rounded-full bg-af-amber/10 border border-af-amber/20 px-2 py-0.5 text-[10px] font-bold text-af-amber">
                            {t("transportPlanner.trips", { n: v.tripsNeeded })}
                          </span>
                        )}
                      </div>
                      <div className="font-mono text-sm font-extrabold text-af-ink">
                        {rupee(v.totalCost)}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Multi-trip warning */}
          {activeVehicle.tripsNeeded > 1 && (
            <div className="flex items-start gap-2.5 rounded-[14px] bg-af-amber/8 border border-af-amber/20 px-4 py-3">
              <AlertTriangle className="w-4 h-4 text-af-amber shrink-0 mt-0.5" />
              <p className="text-[12px] text-af-ink-2">
                {t("transportPlanner.overloadWarning", {
                  weight,
                  vehicle: activeVehicle.name,
                  capacity: activeVehicle.capacity,
                  trips: activeVehicle.tripsNeeded,
                })}
              </p>
            </div>
          )}

          {/* Financial summary */}
          <div className="rounded-[18px] bg-af-bg border border-af-border overflow-hidden">
            <div className="px-4 py-3 border-b border-af-border">
              <div className="flex items-center gap-2">
                <Calculator className="w-4 h-4 text-af-primary" />
                <span className="font-mono text-[10px] font-bold tracking-[0.18em] uppercase text-af-muted">
                  {t("transportPlanner.invoice")}
                </span>
              </div>
            </div>

            <div className="px-4 py-3 space-y-2.5">
              <InvoiceRow
                label={t("transportPlanner.grossRevenue", { qty: weight, price: rupee(mandi.netPrice) })}
                value={rupee(grossRevenue)}
              />
              <InvoiceRow
                label={t("transportPlanner.distanceToMandi")}
                value={`${mandi.distanceKm} km${IS_ROUND_TRIP ? t("transportPlanner.roundTripSuffix") : ""}`}
              />
              <InvoiceRow
                label={t("transportPlanner.transportRow", { vehicle: activeVehicle.name, trips: activeVehicle.tripsNeeded })}
                value={`-${rupee(activeVehicle.totalCost)}`}
                danger
              />

              {/* Divider */}
              <div className="h-px bg-af-border" />

              {/* Net profit */}
              <div className="flex items-center justify-between rounded-[12px] bg-af-primary/8 border border-af-primary/20 px-3 py-2.5">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-af-primary" />
                  <span className="text-sm font-bold text-af-ink">
                    {t("transportPlanner.estimatedEarnings")}
                  </span>
                </div>
                <span className="font-mono text-lg font-extrabold text-af-primary">
                  {rupee(finalEarnings)}
                </span>
              </div>
            </div>
          </div>

          {/* Confirm button */}
          <button
            onClick={onClose}
            className="w-full inline-flex items-center justify-center gap-2 rounded-[14px] bg-af-primary hover:bg-af-primary-deep text-white px-6 py-3.5 text-sm font-bold transition active:scale-[0.98] shadow-af-md"
          >
            <CheckCircle className="w-4 h-4" />
            {t("transportPlanner.confirmBook")}
          </button>

          <p className="text-center text-[11px] text-af-muted">
            {t("transportPlanner.advisory")}
          </p>
        </div>
      </div>
    </div>
  );
}

function InvoiceRow({
  label,
  value,
  danger,
}: {
  label: string;
  value: string;
  danger?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[12px] text-af-ink-2">{label}</span>
      <span
        className={`text-[13px] font-bold font-mono ${
          danger ? "text-af-danger" : "text-af-ink"
        }`}
      >
        {value}
      </span>
    </div>
  );
}