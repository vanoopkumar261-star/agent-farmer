import { getDashboardData } from "@/lib/dashboard";
import { SCHEMES } from "@/lib/schemes";
import SchemesBoard from "@/components/dashboard/SchemesBoard";
import { T } from "@/components/i18n/LanguageProvider";
import { Landmark } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function SchemesPage() {
  const { farmer, farms } = await getDashboardData();

  const crops = Array.from(new Set(farms.map((f) => f.crop?.chosen_crop).filter(Boolean)));
  const totalArea = farms.reduce((s, f) => s + (f.area || 0), 0);
  const soils = Array.from(new Set(farms.map((f) => f.soil_type)));
  const profile = farmer
    ? `${farmer.name}, ${farms.length} farm(s) totalling ${totalArea} acres of ${soils.join(", ")}, growing ${crops.join(", ") || "no crop yet"}, located at ${farmer.house_address ?? "India"}`
    : "an Indian smallholder farmer";

  return (
    <div className="max-w-[1100px] mx-auto">
      <div className="mb-6 flex items-center gap-3">
        <span className="flex items-center justify-center w-11 h-11 rounded-2xl bg-af-sage text-af-secondary">
          <Landmark className="w-5 h-5" />
        </span>
        <div>
          <h1 className="text-[26px] font-extrabold tracking-tight text-af-ink"><T k="title.schemes" /></h1>
          <p className="mt-0.5 text-sm text-af-ink-2">
            Subsidies, insurance &amp; credit — matched to your farm by AI.
          </p>
        </div>
      </div>

      <SchemesBoard schemes={SCHEMES} profile={profile} />
    </div>
  );
}
