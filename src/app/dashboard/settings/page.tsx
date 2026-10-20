import { getDashboardData } from "@/lib/dashboard";
import PageHeader from "@/components/ui/PageHeader";
import SettingsPanel from "@/components/dashboard/SettingsPanel";
import PlanPanel from "@/components/plans/PlanPanel";
import { planOf } from "@/lib/plans";
import { T } from "@/components/i18n/LanguageProvider";
import { Settings as SettingsIcon } from "lucide-react";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const { farmer, farms } = await getDashboardData();

  if (!farmer) {
    return (
      <div className="max-w-md mx-auto mt-20 text-center rounded-2xl bg-af-card border border-af-border shadow-af-sm p-10">
        <h2 className="text-[19px] font-semibold tracking-[-0.02em] text-af-ink"><T k="settings.noProfileTitle" /></h2>
        <p className="mt-2 text-sm text-af-ink-2"><T k="settings.noProfileBody" /></p>
        <Link href="/onboarding" className="mt-6 inline-flex rounded-[14px] bg-af-primary text-white px-6 py-3 text-sm font-semibold">
          <T k="dashboard.home.startOnboarding" />
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-[1100px] mx-auto">
      <PageHeader
        icon={<SettingsIcon className="w-5 h-5" />}
        title={<T k="title.settings" />}
        subtitle={<T k="settings.subtitle" />}
      />

      {/*
        Above the profile form: a farmer who came here to change their plan
        should not have to scroll past their phone number to find it. The
        field count comes from the data this page already loaded, and is what
        stops a downgrade being offered that would strand existing fields.
      */}
      <div className="mb-5">
        <PlanPanel initialPlan={planOf(farmer.plan)} fieldCount={farms?.length ?? 0} />
      </div>

      <SettingsPanel
        profile={{
          id: farmer.id,
          name: farmer.name,
          phone: farmer.phone,
          email: farmer.email,
          house_address: farmer.house_address,
          preferences: farmer.preferences ?? {},
        }}
      />
    </div>
  );
}
