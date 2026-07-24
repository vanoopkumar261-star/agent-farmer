import AssistantChat from "@/components/dashboard/AssistantChat";
import { T } from "@/components/i18n/LanguageProvider";
import { getDashboardData } from "@/lib/dashboard";

export const dynamic = "force-dynamic";

export default async function AssistantPage() {
  const { farmer } = await getDashboardData();

  return (
    <div className="max-w-[1000px] mx-auto">
      <div className="mb-5">
        <h1 className="text-[26px] font-extrabold tracking-tight text-af-ink"><T k="title.assistant" /></h1>
        <p className="mt-1 text-sm text-af-ink-2">
          Your memory-aware farming co-pilot — grounded in your live farm data.
        </p>
      </div>
      <AssistantChat farmerName={farmer?.name ?? "Farmer"} />
    </div>
  );
}
