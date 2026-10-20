import { getDashboardData } from "@/lib/dashboard";
import { extractStateFromAddress } from "@/lib/market";
import { SCHEMES } from "@/lib/schemes";
import SchemesBoard from "@/components/dashboard/SchemesBoard";
import { T } from "@/components/i18n/LanguageProvider";
import PageHeader from "@/components/ui/PageHeader";
import Reveal from "@/components/ui/Reveal";
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

  // The board fetches the live desk itself on mount; this is the state it asks
  // about. SCHEMES below stays the floor that renders before that answers, so
  // first paint is unchanged and instant.
  const state = extractStateFromAddress(farmer?.house_address ?? "");

  return (
    <div className="max-w-[1100px] mx-auto">
      <PageHeader
        icon={<Landmark className="w-5 h-5" />}
        title={<T k="title.schemes" />}
        subtitle={<T k="schemes.subtitle" />}
      />
      <Reveal>
        <SchemesBoard schemes={SCHEMES} profile={profile} state={state} />
      </Reveal>
    </div>
  );
}
