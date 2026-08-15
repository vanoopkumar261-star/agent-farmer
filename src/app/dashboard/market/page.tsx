import { getDashboardData } from "@/lib/dashboard";
import { getMarket, getMandiBoard, deriveRegion } from "@/lib/market";
import { costPrefsFrom } from "@/lib/mandi-costs";
import MarketBoard from "@/components/dashboard/MarketBoard";
import MarketAdvice from "@/components/dashboard/MarketAdvice";
import Reveal from "@/components/ui/Reveal";
import { T } from "@/components/i18n/LanguageProvider";

export const dynamic = "force-dynamic";

export default async function MarketPage() {
  const { farmer, farms } = await getDashboardData();
  const region = deriveRegion(farmer?.house_address);
  const crops = await getMarket(region);

  // Focus on a crop the farmer actually grows, if it's in our market list.
  const farmerCropNames = Array.from(
    new Set(farms.map((f) => f.crop?.chosen_crop).filter(Boolean) as string[])
  );
  const focus =
    crops.find((c) => farmerCropNames.some((n) => n.toLowerCase() === c.name.toLowerCase()))?.name ??
    crops[0].name;

  const mandisByFocus = await getMandiBoard(crops, {
    farmLat: farmer?.house_lat,
    farmLng: farmer?.house_lng,
    prefs: costPrefsFrom(farmer?.preferences),
    region,
  });

  const pricesForAi = crops.map((c) => ({
    name: c.name,
    price: c.price,
    change: c.change,
    demand: c.demand,
  }));

  return (
    <div className="max-w-[1200px] mx-auto">
      <div className="mb-6">
        <h1 className="text-heading font-semibold text-af-ink"><T k="title.market" /></h1>
        <p className="mt-1 text-sm text-af-ink-2">
          Live mandi prices, price trends, and when to sell or hold.
        </p>
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
