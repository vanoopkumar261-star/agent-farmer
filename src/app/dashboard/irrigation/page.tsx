import { Droplets } from "lucide-react";
import EmptyState from "@/components/ui/EmptyState";
import { T } from "@/components/i18n/LanguageProvider";
import { getDashboardData } from "@/lib/dashboard";
import { getIrrigationEventsByFarm } from "@/lib/history";
import { getWeather } from "@/lib/weather";
import { computeIrrigationPlan } from "@/lib/irrigation";
import { localiseIrrigationPlans } from "@/lib/irrigationLocale";
import { getServerLocale } from "@/lib/i18n/serverLocale";
import IrrigationBoard, {
  type FarmPlan,
} from "@/components/dashboard/irrigation/IrrigationBoard";

/**
 * Smart irrigation.
 *
 * Every number on this page is computed here, on the server, by
 * `computeIrrigationPlan()` — a FAO-56 water balance over Open-Meteo's
 * forecast. The client component picks a farm and draws; it does no agronomy,
 * so what a farmer sees cannot drift from what the engine decided.
 *
 * Shown to every farmer, irrigated or not. A rain-fed plot gets the same
 * moisture forecast and stress warnings, just without a schedule it could not
 * act on — see `RainfedAdvisory`.
 */

export const dynamic = "force-dynamic";

export default async function IrrigationPage() {
  const { farmer, farms } = await getDashboardData();

  // One weather fetch for the whole holding: plots are minutes apart, and
  // `getWeather` is cached for 30 minutes anyway.
  const weather = farmer?.house_lat && farmer?.house_lng
    ? await getWeather(farmer.house_lat, farmer.house_lng)
    : null;

  const eventsByFarm = farmer ? await getIrrigationEventsByFarm(farmer.id) : {};

  const locale = getServerLocale();

  const farmPlans: FarmPlan[] = farms.map((f) => {
    const events = eventsByFarm[f.id] ?? [];
    return {
      farmId: f.id,
      // Raw facts, not finished labels: the language lives in a client context,
      // so `IrrigationBoard` does the wording. See the FarmPlan docstring.
      farmIndex: f.farm_index,
      cropName: f.crop ? f.crop.chosen_crop : null,
      events,
      plan: computeIrrigationPlan({
        farm: f,
        crop: f.crop
          ? {
              chosen_crop: f.crop.chosen_crop,
              seeding_date: f.crop.seeding_date,
              estimated_harvest_date: f.crop.estimated_harvest_date,
            }
          : null,
        weather,
        recentEvents: events.map((e) => ({
          applied_at: e.applied_at,
          depth_mm: e.depth_mm,
          volume_litres: e.volume_litres,
        })),
      }),
    };
  });

  /*
    The engine writes its explanations in English from the farm's own numbers,
    so they cannot come from a dictionary. Translating here rather than in the
    browser means the farmer's first paint is already in their language instead
    of English that swaps a second later — and because every number was already
    computed above, a translation failure costs prose and nothing else.
  */
  const localised = await localiseIrrigationPlans(
    farmPlans.map((fp) => fp.plan),
    locale
  );
  const localisedPlans: FarmPlan[] = farmPlans.map((fp, i) => ({
    ...fp,
    plan: localised[i] ?? fp.plan,
  }));

  return (
    <div className="max-w-[1100px] mx-auto">
      <div className="mb-6">
        <h1 className="text-heading font-semibold text-af-ink">
          <T k="title.irrigation" />
        </h1>
        <p className="mt-1 text-sm text-af-ink-2">
          <T k="irrigation.subtitle" />
        </p>
      </div>

      {!farmer ? (
        <EmptyState
          icon={<Droplets className="w-5 h-5" />}
          title={<T k="irrigation.page.setupTitle" />}
          body={<T k="irrigation.page.setupBody" />}
        />
      ) : (
        <IrrigationBoard farmerId={farmer.id} farmPlans={localisedPlans} />
      )}
    </div>
  );
}
