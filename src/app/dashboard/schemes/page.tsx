import { getDashboardData } from "@/lib/dashboard";
import { SCHEMES } from "@/lib/schemes";
import SchemesBoard from "@/components/dashboard/SchemesBoard";
import { T } from "@/components/i18n/LanguageProvider";

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
      <div className="mb-6">
        <h1 className="text-heading font-semibold text-af-ink"><T k="title.schemes" /></h1>
        <p className="mt-1 text-sm text-af-ink-2">
          Central and state subsidies, insurance and credit — matched to your farm details.
        </p>
      </div>

      <SchemesBoard schemes={SCHEMES} profile={profile} />
    </div>
  );
}
