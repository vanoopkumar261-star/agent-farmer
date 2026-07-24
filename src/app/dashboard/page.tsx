import { getDashboardData, cropStage, daysSince, relativeTime } from "@/lib/dashboard";
import { getWeather } from "@/lib/weather";
import { getExpensesData } from "@/lib/expenses";
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
import { Sprout, Ruler, Layers, Wallet } from "lucide-react";
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
        <h2 className="mt-4 text-xl font-extrabold text-af-ink">No farm registered yet</h2>
        <p className="mt-2 text-sm text-af-ink-2">Complete onboarding to see your live farm dashboard.</p>
        <Link
          href="/onboarding"
          className="mt-6 inline-flex items-center justify-center rounded-[14px] bg-af-primary hover:bg-af-primary-deep text-white px-6 py-3 text-sm font-bold transition"
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

  // ---- Derived metrics ----
  const totalArea = farms.reduce((s, f) => s + (f.area || 0), 0);
  const soils = Array.from(new Set(farms.map((f) => f.soil_type)));
  const activeCrops = farms.filter((f) => f.crop).length;
  const seededFarm = farms.find((f) => f.crop);

  const rainSoon = weather?.daily.slice(0, 3).some((d) => d.precipProb >= 50);
  const avgProgress =
    farms.filter((f) => f.crop).reduce((s, f) => s + cropStage(f.crop!.seeding_date).progress, 0) /
    Math.max(1, activeCrops);
  let health = 72 + Math.round(avgProgress * 14);
  if (weather && weather.current.temp > 38) health -= 10;
  if (rainSoon) health += 6;
  health = Math.max(0, Math.min(100, health));

  // Today's tasks (derived from crop stage + weather).
  const tasks: Task[] = [];
  for (const f of farms) {
    if (!f.crop) continue;
    const st = cropStage(f.crop.seeding_date);
    const d = daysSince(f.crop.seeding_date);
    if (st.label === "Seedling" || st.label === "Germination") {
      tasks.push({
        title: `Inspect ${f.crop.chosen_crop} seedlings — Farm ${f.farm_index}`,
        meta: `Day ${d} · ${st.label} stage`,
        done: false,
        tone: "green",
      });
    } else if (st.label === "Vegetative") {
      tasks.push({
        title: `Apply nitrogen top-dressing — Farm ${f.farm_index}`,
        meta: `Day ${d} · Vegetative growth`,
        done: false,
        tone: "amber",
      });
    } else {
      tasks.push({
        title: `Monitor ${f.crop.chosen_crop} — Farm ${f.farm_index}`,
        meta: `Day ${d} · ${st.label}`,
        done: false,
        tone: "blue",
      });
    }
  }
  if (rainSoon) {
    tasks.push({
      title: "Hold irrigation — rain expected",
      meta: "Weather AI · next 72 hours",
      done: false,
      tone: "blue",
    });
  }
  tasks.push({
    title: "Review AI crop recommendations",
    meta: `Completed ${relativeTime(seededFarm?.crop?.created_at ?? farmer.created_at)}`,
    done: true,
    tone: "green",
  });

  // Alerts.
  const alerts: Alert[] = [];
  if (rainSoon) {
    alerts.push({
      kind: "weather",
      title: "Rain likely in the next 3 days",
      body: "Pause scheduled irrigation and ensure field drainage is clear.",
    });
  }
  if (weather && weather.current.temp >= 35) {
    alerts.push({
      kind: "critical",
      title: "High heat stress risk",
      body: `Current ${weather.current.temp}°C. Irrigate early morning to protect ${farms[0]?.crop?.chosen_crop ?? "crops"}.`,
    });
  }
  alerts.push({
    kind: "ai",
    title: "AI insight: optimal growth window",
    body: `${farms[0]?.crop?.chosen_crop ?? "Your crop"} is tracking on schedule. Confidence 86%.`,
  });

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

  const firstCrop = farms.find((f) => f.crop)?.crop;
  const firstCropFarm = farms.find((f) => f.crop);

  return (
    <div className="max-w-[1320px] mx-auto">
      {/* Greeting */}
      <Reveal>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-[28px] font-extrabold tracking-tight text-af-ink">
              <T k={greetingKey()} />, {farmer.name.split(" ")[0]} 👋
            </h1>
            <p className="mt-1 text-sm text-af-ink-2">
              <T k="greeting.sub" />
            </p>
          </div>
          <div className="font-mono text-[11px] font-bold tracking-[0.16em] uppercase text-af-muted">
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
          <StatTile icon={<Sprout className="w-[18px] h-[18px]" />} label="Active Farms" value={farms.length} delta={0}
            spark={[1, 1, 2, 2, 2, 2]} />
        </Reveal>
        <Reveal index={1}>
          <StatTile icon={<Ruler className="w-[18px] h-[18px]" />} label="Total Area" value={totalArea} suffix=" ac" delta={25}
            spark={[4, 5, 6, 7, 9, 10]} />
        </Reveal>
        <Reveal index={2}>
          <StatTile icon={<Layers className="w-[18px] h-[18px]" />} label="Active Crops" value={activeCrops} delta={0}
            spark={[0, 1, 1, 2, 2, 2]} sparkColor="#3B82F6" />
        </Reveal>
        <Reveal index={3}>
          <StatTile icon={<Wallet className="w-[18px] h-[18px]" />} label="Season Profit"
            value={Math.round(expenses.profit / 1000)} prefix="₹" suffix="k"
            delta={expenses.totalIncome > 0 ? Math.round((expenses.profit / expenses.totalIncome) * 100) : 0}
            sparkColor={expenses.profit >= 0 ? "#10B981" : "#D93025"}
            spark={[6, 9, 12, 20, 31, Math.max(1, Math.round(expenses.profit / 1000))]} />
        </Reveal>
      </div>

      {/* Market ticker */}
      <Reveal className="mt-4">
        <MarketTicker />
      </Reveal>

      {/* Main grid */}
      <div className="mt-6 grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Left / center */}
        <div className="xl:col-span-2 space-y-6">
          <Reveal>
            <AiSummaryCard points={summary} />
          </Reveal>
          <Reveal>
            <AnalyticsCard cash={cashPoints} netProfit={expenses.profit} />
          </Reveal>
          <Reveal>
            <WeatherCard weather={weather} place={place} />
          </Reveal>

          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-extrabold text-af-ink">Your Farms</h2>
              <Link href="/onboarding" className="text-sm font-bold text-af-primary-deep hover:underline">
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
              <span className="self-start font-mono text-[10px] font-bold tracking-[0.2em] uppercase text-af-muted">
                Farm Health
              </span>
              <div className="my-3">
                <HealthRing value={health} label="Score" />
              </div>
              <p className="text-center text-[13px] text-af-ink-2 leading-relaxed">
                {health >= 75
                  ? "Your farms are in great shape."
                  : health >= 50
                  ? "Healthy, with a few items to watch."
                  : "Needs attention — check alerts."}
              </p>
            </Card>
          </Reveal>

          {firstCrop && firstCropFarm && (
            <Reveal>
              <UpcomingHarvest
                crop={firstCrop.chosen_crop}
                seedingDate={firstCrop.seeding_date}
                farmIndex={firstCropFarm.farm_index}
              />
            </Reveal>
          )}

          <Reveal>
            <TasksCard tasks={tasks} />
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
