import { getDashboardData } from "@/lib/dashboard";
import { getMarket, nearbyMandis, MandiRow } from "@/lib/market";
import MarketBoard from "@/components/dashboard/MarketBoard";
import MarketAdvice from "@/components/dashboard/MarketAdvice";
import Reveal from "@/components/ui/Reveal";
import { T } from "@/components/i18n/LanguageProvider";
import { ShoppingCart } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function MarketPage() {
  const { farmer, farms } = await getDashboardData();
  const crops = getMarket();

  // Focus on a crop the farmer actually grows, if it's in our market list.
  const farmerCropNames = Array.from(
    new Set(farms.map((f) => f.crop?.chosen_crop).filter(Boolean) as string[])
  );
  const focus =
    crops.find((c) => farmerCropNames.some((n) => n.toLowerCase() === c.name.toLowerCase()))?.name ??
    crops[0].name;

  const mandisByFocus: Record<string, MandiRow[]> = {};
  for (const c of crops) mandisByFocus[c.name] = nearbyMandis(c);

  const pricesForAi = crops.map((c) => ({
    name: c.name,
    price: c.price,
    change: c.change,
    demand: c.demand,
  }));

  return (
    <div className="max-w-[1200px] mx-auto">
      <div className="mb-6 flex items-center gap-3">
        <span className="flex items-center justify-center w-11 h-11 rounded-2xl bg-af-sage text-af-secondary">
          <ShoppingCart className="w-5 h-5" />
        </span>
        <div>
          <h1 className="text-[26px] font-extrabold tracking-tight text-af-ink"><T k="title.market" /></h1>
          <p className="mt-0.5 text-sm text-af-ink-2">
            Live mandi prices, trends, and AI-powered selling windows.
          </p>
        </div>
      </div>

      <div className="space-y-6">
        <Reveal>
          <MarketAdvice prices={pricesForAi} farmerCrops={farmerCropNames} />
        </Reveal>
        <Reveal>
          <MarketBoard crops={crops} mandisByFocus={mandisByFocus} focusName={focus} />
        </Reveal>
      </div>
    </div>
  );
}
