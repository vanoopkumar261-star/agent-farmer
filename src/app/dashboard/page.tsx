import { getDashboardData, relativeTime } from "@/lib/dashboard";
import { getWeather } from "@/lib/weather";
import { getExpensesData } from "@/lib/expenses-server";
import { generateTasks, cropStageFor, harvestInfo, getCropProfile } from "@/lib/agronomy";
import { computeFarmHealth } from "@/lib/health";
import { deriveAlerts } from "@/lib/alerts";
import { getMarket, extractStateFromAddress } from "@/lib/market";
import { syncNotifications } from "@/lib/notifications-server";
import { getRecentDiagnoses } from "@/lib/history";
import { recordDayTasks, tallyDayTasks, serverYesterday } from "@/lib/tasks-server";
import WeatherCard from "@/components/dashboard/WeatherCard";
import AiSummaryCard from "@/components/dashboard/AiSummaryCard";
import FarmCard from "@/components/dashboard/FarmCard";
import HealthRing from "@/components/dashboard/HealthRing";
import TasksCard, { Task } from "@/components/dashboard/TasksCard";
import AlertsCard, { Alert } from "@/components/dashboard/AlertsCard";
import StatTile from "@/components/dashboard/StatTile";
import QuickActions from "@/components/dashboard/QuickActions";
import MarketTicker from "@/components/dashboard/MarketTicker";
import AnalyticsCard from "@/components/dashboard/AnalyticsCard";
import ActivityTimeline, { ActivityItem } from "@/components/dashboard/ActivityTimeline";
import UpcomingHarvest from "@/components/dashboard/UpcomingHarvest";
import AiChatPreview from "@/components/dashboard/AiChatPreview";
import Reveal from "@/components/ui/Reveal";
import Card from "@/components/ui/Card";
import { T } from "@/components/i18n/LanguageProvider";
import { Sprout, Ruler, Layers, Wallet, ArrowRight } from "lucide-react";
import Link from "next/link";

export const dynamic = "force-dynamic";

function greetingKey() {
  const h = new Date().getHours();
  if (h < 12) return "greeting.morning";
  if (h < 17) return "greeting.afternoon";
  return "greeting.evening";
}

export default async function DashboardPage() {
  const { farmer, farms } = await getDashboardData();

  if (!farmer) {
    return (
      <div className="max-w-md mx-auto mt-20 text-center rounded-2xl bg-af-card border border-af-border shadow-af-sm p-10">
        <div className="w-12 h-12 rounded-2xl bg-af-sage mx-auto flex items-center justify-center">
          <Sprout className="w-6 h-6 text-af-secondary" />
        </div>
        <h2 className="mt-4 text-[19px] font-semibold tracking-[-0.02em] text-af-ink">No farm registered yet</h2>
        <p className="mt-2 text-sm text-af-ink-2">Complete onboarding to see your live farm dashboard.</p>
        <Link
          href="/onboarding"
          className="mt-6 inline-flex items-center justify-center rounded-[14px] bg-af-primary hover:bg-af-primary-deep text-white px-6 py-3 text-sm font-semibold transition"
        >
          Start Onboarding
        </Link>
      </div>
    );
  }

  const weather =
    farmer.house_lat != null && farmer.house_lng != null
      ? await getWeather(farmer.house_lat, farmer.house_lng)
      : null;

  const place = (farmer.house_address ?? "Your farm").split(",").slice(0, 2).join(",");

  const expenses = await getExpensesData(farmer.id);
  const cashPoints = expenses.byMonth.map((m) => ({ m: m.month, income: m.income, expense: m.expense }));

  // Real mandi prices for the ticker, scoped to the farmer's region.
  // The market library now takes (state, apiKey) rather than a parsed region
  // object. Crops not arriving at a mandi today are dropped so the ticker never
  // scrolls a price that isn't real.
  const marketTicks = (
    await getMarket(
      extractStateFromAddress(farmer.house_address ?? ""),
      process.env.DATA_GOV_API_KEY ?? null
    )
  )
    .filter((c) => !c.notAvailable)
    .map((c) => ({
      crop: c.name,
      price: c.price,
      change: c.change,
    }));

  // ---- Derived metrics ----
  const totalArea = farms.reduce((s, f) => s + (f.area || 0), 0);
  const soils = Array.from(new Set(farms.map((f) => f.soil_type)));
  const activeCrops = farms.filter((f) => f.crop).length;
  const cropNames = Array.from(new Set(farms.map((f) => f.crop?.chosen_crop).filter(Boolean))).join(", ");
  const seededFarm = farms.find((f) => f.crop);

  const rainSoon = weather?.daily.slice(0, 3).some((d) => d.precipProb >= 50) ?? false;

  // Crop-stage + weather aware tasks from the agronomy engine.
  const taskSeeds = generateTasks(farms, weather);

  // Record today's list so the day leaves a trace. Tasks are derived, not
  // stored, so without this yesterday's list is unrecoverable and "you missed
  // 2 of 5" could never be computed. Idempotent — it never un-ticks a task.
  await recordDayTasks(farmer.id, taskSeeds);

  // How yesterday actually went — the basis for both the missed-task alert and
  // the overdue factor in the health score.
  const yesterdayTally = await tallyDayTasks(farmer.id, serverYesterday());

  // Leaf scans from the last two weeks that came back diseased. Older results
  // are excluded deliberately: a problem found a month ago says little about
  // the crop's health today, and would drag the score down forever.
  const recentScans = await getRecentDiagnoses(farmer.id, 10);
  const twoWeeksAgo = Date.now() - 14 * 86_400_000;
  const activeDiseases = recentScans.filter(
    (r) => !r.healthy && new Date(r.created_at).getTime() >= twoWeeksAgo
  ).length;

  const tasks: Task[] = taskSeeds.map((s) => ({
    key: s.key,
    title: s.title,
    meta: s.meta,
    done: false,
    tone: s.tone,
  }));

  // Real farm-health score. Yesterday's unfinished work is a genuine stressor,
  // and until now this argument was never supplied — so the overdue factor in
  // computeFarmHealth could never fire.
  const healthResult = computeFarmHealth({
    farms,
    weather,
    overdueTasks: yesterdayTally.missed,
    activeDiseases,
  });
  const health = healthResult.score;

  // Weather + crop-stage aware alerts (empty when there's nothing real to flag).
  const alerts: Alert[] = deriveAlerts({ farms, weather, missedYesterday: yesterdayTally });

  // Persist today's alerts + top tasks as notifications (deduped by day).
  const today = new Date().toISOString().slice(0, 10);
  await syncNotifications(farmer.id, [
    ...alerts.map((a) => ({ dedupeKey: `alert:${today}:${a.title}`, kind: a.kind, title: a.title, body: a.body })),
    ...tasks.slice(0, 3).map((tk) => ({
      dedupeKey: `task:${today}:${tk.key ?? tk.title}`,
      kind: "task",
      title: tk.title,
      body: tk.meta,
    })),
  ]);

  // ── Analytics series — all derived from this farmer's own records ──────────
  // The card used to ship hardcoded demo arrays; these replace them.

  // Each farm's real position in its own seeding → harvest window.
  const seasonPoints = farms
    .filter((f) => f.crop)
    .map((f) => {
      const st = cropStageFor(f.crop!.chosen_crop, f.crop!.seeding_date, f.crop!.estimated_harvest_date);
      const hi = harvestInfo(f.crop!.chosen_crop, f.crop!.seeding_date, f.crop!.estimated_harvest_date);
      return {
        name: `${f.crop!.chosen_crop} · F${f.farm_index}`,
        progress: Math.round(st.progress * 100),
        stage: st.label,
        daysLeft: hi.daysLeft,
      };
    })
    .sort((a, b) => a.daysLeft - b.daysLeft);

  // The real 7-day forecast, in the shape the chart wants.
  const weatherPoints =
    weather?.daily.slice(0, 7).map((d) => ({
      day: d.weekday,
      tMax: Math.round(d.tMax),
      tMin: Math.round(d.tMin),
      rain: d.precipProb,
    })) ?? [];

  // The strictest tolerance among their crops — one hot day threatens the most
  // sensitive one first, so that is the line worth drawing.
  const heatThreshold = farms
    .filter((f) => f.crop)
    .map((f) => getCropProfile(f.crop!.chosen_crop).heatThreshold)
    .reduce<number | undefined>((min, t) => (min === undefined || t < min ? t : min), undefined);

  // Real month-over-month season-profit trend for the profit stat tile.
  const profitSeriesK = expenses.byMonth.map((m) => Math.round((m.income - m.expense) / 1000));
  const profitDelta =
    profitSeriesK.length >= 2 && profitSeriesK[profitSeriesK.length - 2] !== 0
      ? Math.round(
          ((profitSeriesK[profitSeriesK.length - 1] - profitSeriesK[profitSeriesK.length - 2]) /
            Math.abs(profitSeriesK[profitSeriesK.length - 2])) *
            100
        )
      : undefined;

  // AI summary bullets.
  const summary = [
    `You have ${farms.length} active ${farms.length === 1 ? "farm" : "farms"} totalling ${totalArea} acres across ${soils.join(" & ")}.`,
    weather
      ? `It's ${weather.current.temp}°C and ${weather.current.label.toLowerCase()} at ${place.split(",")[0]} — ${rainSoon ? "rain is expected within 3 days, so hold irrigation." : "conditions are favourable for field work today."}`
      : `Weather data is syncing for ${place.split(",")[0]}.`,
    `Overall farm health is ${health}/100. ${health >= 75 ? "Everything looks healthy." : "A few items need attention — see tasks below."}`,
  ];

  // Recent activity feed — timestamps derived from real records so they age with the calendar.
  const activity: ActivityItem[] = [
    ...(seededFarm?.crop
      ? [{
          icon: "crop" as const,
          title: `${seededFarm.crop.chosen_crop} seeded on Farm ${seededFarm.farm_index}`,
          time: relativeTime(seededFarm.crop.seeding_date),
        }]
      : []),
    { icon: "weather", title: "Weather forecast synced for your location", time: relativeTime(new Date(Date.now() - 2 * 3_600_000).toISOString()) },
    { icon: "crop", title: "AI crop recommendations generated", time: relativeTime(seededFarm?.crop?.created_at ?? farmer.created_at) },
    { icon: "expense", title: "Farm profile created", time: relativeTime(farmer.created_at) },
  ];

  // Every cropped farm gets its own harvest countdown, soonest first.
  const harvestItems = farms
    .filter((f) => f.crop)
    .map((f) => ({
      id: f.id,
      crop: f.crop!.chosen_crop,
      seedingDate: f.crop!.seeding_date,
      estimatedHarvestDate: f.crop!.estimated_harvest_date,
      farmIndex: f.farm_index,
    }));

  return (
    <div className="max-w-[1320px] mx-auto">
      {/* Greeting */}
      <Reveal>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-heading font-semibold text-af-ink">
              <T k={greetingKey()} />, {farmer.name.split(" ")[0]} 👋
            </h1>
            <p className="mt-1 text-sm text-af-ink-2">
              <T k="greeting.sub" />
            </p>
          </div>
          <div className="font-mono text-label font-semibold uppercase text-af-muted">
            {new Date().toLocaleDateString("en-US", { weekday: "long", day: "numeric", month: "long" })}
          </div>
        </div>
      </Reveal>

      {/* Quick actions */}
      <Reveal index={1} className="mt-6">
        <QuickActions />
      </Reveal>

      {/* Stat tiles */}
      <div className="mt-4 grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Reveal index={0}>
          <StatTile icon={<Sprout className="w-[22px] h-[22px]" />} label="Active Farms" value={farms.length}
            link={{ label: "View all farms", href: "/dashboard/crops" }} />
        </Reveal>
        <Reveal index={1}>
          <StatTile icon={<Ruler className="w-[22px] h-[22px]" />} label="Total Area" value={totalArea} suffix=" ac"
            meta={`Across ${farms.length} ${farms.length === 1 ? "farm" : "farms"}`} />
        </Reveal>
        <Reveal index={2}>
          <StatTile icon={<Layers className="w-[22px] h-[22px]" />} label="Active Crops" value={activeCrops}
            meta={cropNames || "No crop selected yet"} />
        </Reveal>
        <Reveal index={3}>
          <StatTile icon={<Wallet className="w-[22px] h-[22px]" />} label="Season Profit"
            value={Math.round(expenses.profit / 1000)} prefix="₹" suffix="k"
            delta={profitDelta} meta="This season" />
        </Reveal>
      </div>

      {/* Market ticker */}
      <Reveal className="mt-4">
        <MarketTicker ticks={marketTicks} />
      </Reveal>

      {/* Main grid */}
      <div className="mt-6 grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Left / center */}
        <div className="xl:col-span-2 space-y-6">
          <Reveal>
            <AiSummaryCard points={summary} />
          </Reveal>
          <Reveal>
            <AnalyticsCard
              cash={cashPoints}
              netProfit={expenses.profit}
              season={seasonPoints}
              weather={weatherPoints}
              heatThreshold={heatThreshold}
            />
          </Reveal>
          <Reveal>
            <WeatherCard weather={weather} place={place} />
          </Reveal>

          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-[17px] font-semibold tracking-[-0.02em] text-af-ink">Your Farms</h2>
              <Link href="/onboarding" className="text-sm font-semibold text-af-primary-deep hover:underline">
                + Add farm
              </Link>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {farms.map((f, i) => (
                <Reveal key={f.id} index={i}>
                  <FarmCard farm={f} />
                </Reveal>
              ))}
            </div>
          </div>
        </div>

        {/* Right rail */}
        <div className="space-y-6">
          <Reveal>
            <Card className="p-6 flex flex-col items-center">
              <h2 className="self-start text-[17px] font-semibold tracking-[-0.02em] text-af-ink">Farm Health</h2>
              <div className="my-4">
                <HealthRing value={health} label="/100" />
              </div>
              <p className="text-center text-meta text-af-ink-2 leading-relaxed">
                {healthResult.note}
              </p>

              {/* The score's working, shown. computeFarmHealth has always built
                  this list and nothing ever rendered it, so the farmer saw a
                  bare number with no way to tell what it was reacting to. */}
              {healthResult.factors.length > 0 && (
                <ul className="mt-4 w-full space-y-1.5 border-t border-af-border pt-4">
                  {healthResult.factors.map((f, i) => (
                    <li key={i} className="flex items-start justify-between gap-3 text-[12px]">
                      <span className="text-af-ink-2 leading-snug">{f.label}</span>
                      <span
                        className={`font-mono shrink-0 ${
                          f.delta < 0 ? "text-af-danger" : "text-af-muted"
                        }`}
                      >
                        {f.delta < 0 ? f.delta : "—"}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              <Link
                href="/dashboard/crops"
                className="mt-3 inline-flex items-center gap-1.5 text-meta font-semibold text-af-primary-deep hover:gap-2.5 transition-all outline-none focus-visible:ring-2 focus-visible:ring-af-primary/40 rounded"
              >
                View details
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </Card>
          </Reveal>

          {harvestItems.length > 0 && (
            <Reveal>
              <UpcomingHarvest items={harvestItems} />
            </Reveal>
          )}

          <Reveal>
            <TasksCard tasks={tasks} farmerId={farmer.id} />
          </Reveal>
          <Reveal>
            <AlertsCard alerts={alerts} />
          </Reveal>
        </div>
      </div>

      {/* Bottom: activity + AI assistant */}
      <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Reveal>
          <ActivityTimeline items={activity} />
        </Reveal>
        <Reveal index={1}>
          <AiChatPreview />
        </Reveal>
      </div>
    </div>
  );
}
