import Link from "next/link";
import { getDashboardData } from "@/lib/dashboard";
import { getNearbyStores } from "@/lib/stores";
import StoreLocatorClient from "@/components/dashboard/StoreLocatorClient";
import Reveal from "@/components/ui/Reveal";
import { T } from "@/components/i18n/LanguageProvider";
import { MapPin } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function StoreLocatorPage() {
  const { farmer } = await getDashboardData();

  if (!farmer || farmer.house_lat == null || farmer.house_lng == null) {
    return (
      <div className="max-w-md mx-auto mt-20 text-center rounded-2xl bg-af-card border border-af-border shadow-af-sm p-10">
        <div className="w-12 h-12 rounded-2xl bg-af-sage mx-auto flex items-center justify-center">
          <MapPin className="w-6 h-6 text-af-secondary" />
        </div>
        <h2 className="mt-4 text-[19px] font-semibold tracking-[-0.02em] text-af-ink"><T k="stores.noLocationTitle" /></h2>
        <p className="mt-2 text-sm text-af-ink-2">
          <T k="stores.noLocationBody" />
        </p>
        <Link
          href="/onboarding"
          className="mt-6 inline-flex rounded-[14px] bg-af-primary text-white px-6 py-3 text-sm font-semibold"
        >
          <T k="stores.setLocation" />
        </Link>
      </div>
    );
  }

  const stores = await getNearbyStores(farmer.house_lat, farmer.house_lng);
  const place = (farmer.house_address ?? "your location").split(",").slice(0, 2).join(",");

  return (
    <div className="max-w-[1200px] mx-auto">
      <div className="mb-6 flex items-center gap-3">
        <span className="flex items-center justify-center w-11 h-11 rounded-2xl bg-af-sage text-af-secondary">
          <MapPin className="w-5 h-5" />
        </span>
        <div>
          <h1 className="text-heading font-semibold text-af-ink"><T k="title.stores" /></h1>
          <p className="mt-0.5 text-sm text-af-ink-2">
            <T k="stores.subtitle" params={{ place: place.split(",")[0] }} />
          </p>
        </div>
      </div>

      <Reveal>
        <StoreLocatorClient
          house={{ lat: farmer.house_lat, lng: farmer.house_lng, address: farmer.house_address }}
          stores={stores}
        />
      </Reveal>
    </div>
  );
}
