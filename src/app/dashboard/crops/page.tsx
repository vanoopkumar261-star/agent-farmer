import { getDashboardData, cropStage, daysSince } from "@/lib/dashboard";
import CropDetailCard from "@/components/dashboard/CropDetailCard";
import StatTile from "@/components/dashboard/StatTile";
import Reveal from "@/components/ui/Reveal";
import EmptyState from "@/components/ui/EmptyState";
import { T } from "@/components/i18n/LanguageProvider";
import { Sprout, Layers, Ruler, CalendarClock } from "lucide-react";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function CropsPage() {
  const { farmer, farms } = await getDashboardData();

  if (!farmer) {
    return (
      <div className="max-w-md mx-auto mt-16">
        <div className="rounded-2xl bg-af-card border border-af-border shadow-af-sm">
          <EmptyState
            icon={<Sprout className="w-6 h-6" />}
            title="No crops yet"
            body="Register a farm and pick crops to see them here."
            action={
              <Link href="/onboarding" className="inline-flex rounded-[14px] bg-af-primary text-white px-6 py-3 text-sm font-bold">
                Start Onboarding
              </Link>
            }
          />
        </div>
      </div>
    );
  }

  const withCrop = farms.filter((f) => f.crop);
  const totalArea = farms.reduce((s, f) => s + (f.area || 0), 0);
  const nextHarvestDays = withCrop.length
    ? Math.min(
        ...withCrop.map((f) => {
          const h = new Date(f.crop!.seeding_date).getTime() + 120 * 86_400_000;
          return Math.max(0, Math.ceil((h - Date.now()) / 86_400_000));
        })
      )
    : 0;

  return (
    <div className="max-w-[1100px] mx-auto">
      <div className="mb-6 flex items-center gap-3">
        <span className="flex items-center justify-center w-11 h-11 rounded-2xl bg-af-sage text-af-secondary">
          <Sprout className="w-5 h-5" />
        </span>
        <div>
          <h1 className="text-[26px] font-extrabold tracking-tight text-af-ink"><T k="title.crops" /></h1>
          <p className="mt-0.5 text-sm text-af-ink-2">Every field, its stage, and the road to harvest.</p>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Reveal index={0}>
          <StatTile icon={<Sprout className="w-[18px] h-[18px]" />} label="Active Crops" value={withCrop.length} spark={[0, 1, 1, 2, 2, withCrop.length]} />
        </Reveal>
        <Reveal index={1}>
          <StatTile icon={<Ruler className="w-[18px] h-[18px]" />} label="Total Area" value={totalArea} suffix=" ac" spark={[4, 5, 6, 7, 9, totalArea]} />
        </Reveal>
        <Reveal index={2}>
          <StatTile icon={<Layers className="w-[18px] h-[18px]" />} label="Farms" value={farms.length} sparkColor="#3B82F6" spark={[1, 1, 2, 2, 2, farms.length]} />
        </Reveal>
        <Reveal index={3}>
          <StatTile icon={<CalendarClock className="w-[18px] h-[18px]" />} label="Next Harvest" value={nextHarvestDays} suffix=" d" sparkColor="#F59E0B" spark={[120, 110, 100, 90, 100, nextHarvestDays]} />
        </Reveal>
      </div>

      <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-4">
        {farms.map((f, i) => (
          <Reveal key={f.id} index={i}>
            <CropDetailCard farm={f} />
          </Reveal>
        ))}
      </div>
    </div>
  );
}
