import { getDashboardData } from "@/lib/dashboard";
import { extractStateFromAddress } from "@/lib/market";
import NewsCard from "@/components/dashboard/NewsCard";
import { Newspaper } from "lucide-react";

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
      <NewsCard farmerCrops={farmerCrops} state={state} />
    </div>
  );
}