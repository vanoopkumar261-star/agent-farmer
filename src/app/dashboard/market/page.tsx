import { extractStateFromAddress, MandiRow } from "@/lib/market";
import { getMarketForState, getMandiRowsForState, hasMarketKey } from "@/lib/market-server";
import { getDashboardData } from "@/lib/dashboard";
import MarketBoard from "@/components/dashboard/MarketBoard";
import MarketAdvice from "@/components/dashboard/MarketAdvice";
import Reveal from "@/components/ui/Reveal";
import { T } from "@/components/i18n/LanguageProvider";
import { ShoppingCart, Wifi, WifiOff } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function MarketPage() {
  // Reads the session rather than the mockFarmer this page shipped with, so
  // each farmer sees their own state and crops instead of Meghalaya.
  const { farmer, farms } = await getDashboardData();

  const state = extractStateFromAddress(farmer?.house_address ?? "");
  const marketKeyConfigured = hasMarketKey();

  const crops = await getMarketForState(state);

  // Derived from what actually returned. getMarket falls back to generated
  // series on any API failure, so keying the badge off apiKey && state alone
  // labelled demo numbers "Live · <state> · Agmarknet".
  const isRealData = crops.some((c) => c.isReal);

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
      mandisByFocus[c.name] = await getMandiRowsForState(c.name, state);
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
            <h1 className="text-[26px] font-extrabold tracking-tight text-af-ink">
              <T k="title.market" />
            </h1>
            <p className="mt-0.5 text-sm text-af-ink-2">
              <T k="market.subtitle" />
            </p>
          </div>
        </div>

        <div
          className={`inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-[11px] font-bold ${
            isRealData
              ? "bg-af-primary/8 border-af-primary/20 text-af-primary-deep"
              : "bg-af-bg border-af-border text-af-muted"
          }`}
        >
          {isRealData ? (
            <>
              <Wifi className="w-3.5 h-3.5" />
              <T k="market.live" params={{ state: state ?? "" }} />
            </>
          ) : (
            <>
              <WifiOff className="w-3.5 h-3.5" />
              {!marketKeyConfigured ? (
                <T k="market.demoNoKey" />
              ) : !state ? (
                <T k="market.demoNoState" />
              ) : (
                <T k="market.demoNoAgmarknet" params={{ state }} />
              )}
            </>
          )}
        </div>
      </div>

      {isRealData && state && (
        <div className="mb-4 flex items-center gap-2 rounded-[14px] bg-af-primary/6 border border-af-primary/15 px-4 py-2.5">
          <span className="text-[13px] text-af-primary-deep font-semibold">
            <T k="market.showingFor" params={{ state }} />
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