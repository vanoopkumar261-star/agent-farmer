import { getDashboardData } from "@/lib/dashboard";
import SettingsPanel from "@/components/dashboard/SettingsPanel";
import { T } from "@/components/i18n/LanguageProvider";
import { Settings as SettingsIcon } from "lucide-react";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const { farmer } = await getDashboardData();

  if (!farmer) {
    return (
      <div className="max-w-md mx-auto mt-20 text-center rounded-2xl bg-af-card border border-af-border shadow-af-sm p-10">
        <h2 className="text-xl font-extrabold text-af-ink">No profile</h2>
        <p className="mt-2 text-sm text-af-ink-2">Complete onboarding first.</p>
        <Link href="/onboarding" className="mt-6 inline-flex rounded-[14px] bg-af-primary text-white px-6 py-3 text-sm font-bold">
          Start Onboarding
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-[1100px] mx-auto">
      <div className="mb-6 flex items-center gap-3">
        <span className="flex items-center justify-center w-11 h-11 rounded-2xl bg-af-sage text-af-secondary">
          <SettingsIcon className="w-5 h-5" />
        </span>
        <div>
          <h1 className="text-[26px] font-extrabold tracking-tight text-af-ink"><T k="title.settings" /></h1>
          <p className="mt-0.5 text-sm text-af-ink-2">Manage your profile, language, notifications &amp; security.</p>
        </div>
      </div>

      <SettingsPanel
        profile={{
          id: farmer.id,
          name: farmer.name,
          phone: farmer.phone,
          email: farmer.email,
          house_address: farmer.house_address,
        }}
      />
    </div>
  );
}
