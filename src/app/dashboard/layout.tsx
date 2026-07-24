import Sidebar from "@/components/Sidebar";
import TopBar from "@/components/dashboard/TopBar";
import AppBackground from "@/components/dashboard/AppBackground";
import SpotlightLayer from "@/components/dashboard/SpotlightLayer";
import AppFooter from "@/components/dashboard/AppFooter";
import { LanguageProvider } from "@/components/i18n/LanguageProvider";
import { getDashboardData } from "@/lib/dashboard";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { farmer } = await getDashboardData();
  const farmerName = farmer?.name ?? "Farmer";

  return (
    <LanguageProvider>
      <div className="relative flex bg-af-bg min-h-screen text-af-ink">
        <AppBackground />
        <SpotlightLayer />
        <Sidebar />
        <div className="relative z-10 flex-1 min-w-0 flex flex-col">
          <TopBar farmerName={farmerName} />
          <main className="flex-1 px-6 lg:px-8 py-7">{children}</main>
          <AppFooter />
        </div>
      </div>
    </LanguageProvider>
  );
}
