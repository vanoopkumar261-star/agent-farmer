import { getDashboardData } from "@/lib/dashboard";
import { extractStateFromAddress } from "@/lib/market";
import NewsCard from "@/components/dashboard/NewsCard";
import { Newspaper } from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";
import Reveal from "@/components/ui/Reveal";
import { T } from "@/components/i18n/LanguageProvider";

export const dynamic = "force-dynamic";

export default async function NewsPage() {
  const { farmer, farms } = await getDashboardData();

  const farmerCrops = Array.from(
    new Set(
      farms
        .map((f) => f.crop?.chosen_crop)
        .filter(Boolean) as string[]
    )
  );

  const state = extractStateFromAddress(farmer?.house_address ?? "");

  return (
    <div className="max-w-[1100px] mx-auto">
      <PageHeader
        icon={<Newspaper className="w-5 h-5" />}
        title={<T k="title.news" />}
        subtitle={<T k="news.subtitle" />}
      />
      <Reveal>
        <NewsCard farmerCrops={farmerCrops} state={state} />
      </Reveal>
    </div>
  );
}