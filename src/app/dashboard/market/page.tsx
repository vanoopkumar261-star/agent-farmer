import { getMarket, getMandiRows, extractStateFromAddress, MandiRow } from "@/lib/market";
import { getDashboardData } from "@/lib/dashboard";
import MarketBoard from "@/components/dashboard/MarketBoard";
import MarketAdvice from "@/components/dashboard/MarketAdvice";
import Reveal from "@/components/ui/Reveal";
import { T } from "@/components/i18n/LanguageProvider";
import { ShoppingCart, Wifi, WifiOff } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function MarketPage() {
  // This page arrived with a hardcoded mockFarmer (Meghalaya / Wheat / Paddy)
  // because it was written against a snapshot that had no auth. Reading the
  // session instead is what makes it show each farmer their own state and crops
  // — otherwise every account sees the same Meghalaya prices.
  const { farmer, farms } = await getDashboardData();

  const apiKey = process.env.DATA_GOV_API_KEY ?? null;
  const state = extractStateFromAddress(farmer?.house_address ?? "");
  const isRealData = Boolean(apiKey && state);

  const crops = await getMarket(state, apiKey);

  const farmerCropNames = Array.from(
    new Set(farms.map((f) => f.crop?.chosen_crop).filter(Boolean) as string[])
  );

  // ✅ Fix 2: separate available vs unavailable for AI
  const availableCrops = crops.filter((c) => !c.notAvailable);
  const unavailableCrops = crops.filter((c) => c.notAvailable);
  const unavailableCropNames = unavailableCrops.map((c) => c.name);

  const focus =
    availableCrops.find((c) =>
      farmerCropNames.some((n) => n.toLowerCase() === c.name.toLowerCase())
    )?.name ?? availableCrops[0]?.name ?? crops[0].name;

  const mandisByFocus: Record<string, MandiRow[]> = {};
  await Promise.all(
    crops.map(async (c) => {
      if (c.notAvailable) {
        mandisByFocus[c.name] = [];
        return;
      }
      mandisByFocus[c.name] = await getMandiRows(c.name, state, apiKey);
    })
  );

  // Prices for AI — only available ones + flag unavailable
  const pricesForAi = crops.map((c) => ({
    name: c.name,
    price: c.price,
    change: c.change,
    demand: c.demand,
    notAvailable: c.notAvailable ?? false,
  }));

  return (
    <div className="max-w-[1200px] mx-auto">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex items-center justify-center w-11 h-11 rounded-2xl bg-af-sage text-af-secondary">
            <ShoppingCart className="w-5 h-5" />
          </span>
          <div>
            <h1 className="text-heading font-semibold text-af-ink">
              <T k="title.market" />
            </h1>
            <p className="mt-0.5 text-sm text-af-ink-2">
              Live mandi prices, trends, and AI-powered selling windows.
            </p>
          </div>
        </div>

        <div
          className={`inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-[11px] font-semibold ${
            isRealData
              ? "bg-af-primary/10 border-af-primary/20 text-af-primary-deep"
              : "bg-af-bg border-af-border text-af-muted"
          }`}
        >
          {isRealData ? (
            <>
              <Wifi className="w-3.5 h-3.5" />
              Live · {state} · Agmarknet
            </>
          ) : (
            <>
              <WifiOff className="w-3.5 h-3.5" />
              {!apiKey ? "Demo mode · Add DATA_GOV_API_KEY" : "Demo mode · State not detected"}
            </>
          )}
        </div>
      </div>

      {isRealData && state && (
        <div className="mb-4 flex items-center gap-2 rounded-[14px] bg-af-primary/5 border border-af-primary/15 px-4 py-2.5">
          <span className="text-[13px] text-af-primary-deep font-semibold">
            📍 Showing mandi prices for <strong>{state}</strong> from AGMARKNET (data.gov.in)
          </span>
        </div>
      )}

      <div className="space-y-6">
        <Reveal>
          {/* ✅ Fix 2: pass unavailableCrops + state to MarketAdvice */}
          <MarketAdvice
            prices={pricesForAi}
            farmerCrops={farmerCropNames}
            unavailableCrops={unavailableCropNames}
            state={state ?? undefined}
          />
        </Reveal>
        <Reveal>
          <MarketBoard
            crops={crops}
            mandisByFocus={mandisByFocus}
            focusName={focus}
            state={state}
            isRealData={isRealData}
          />
        </Reveal>
      </div>
    </div>
  );
}