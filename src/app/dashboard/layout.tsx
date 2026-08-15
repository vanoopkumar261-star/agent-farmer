import Sidebar from "@/components/Sidebar";
import TopBar from "@/components/dashboard/TopBar";
import AppBackground from "@/components/dashboard/AppBackground";
import SpotlightLayer from "@/components/dashboard/SpotlightLayer";
import AppFooter from "@/components/dashboard/AppFooter";
import { redirect } from "next/navigation";
import { LanguageProvider } from "@/components/i18n/LanguageProvider";
import AssistantProvider from "@/components/dashboard/AssistantProvider";
import AssistantDock from "@/components/dashboard/AssistantDock";
import VoiceMode from "@/components/dashboard/VoiceMode";
import { getDashboardData } from "@/lib/dashboard";
import { getRecentChat } from "@/lib/history";
import { assistantSuggestions } from "@/lib/assistant-suggestions";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { farmer, farms } = await getDashboardData();

  // Middleware guarantees a signed-in user here. If they haven't created a
  // profile yet, send them through onboarding before showing the dashboard.
  if (!farmer) redirect("/onboarding");

  const farmerName = farmer.name ?? "Farmer";
  const farmerId = farmer.id;

  // Hoisted to the layout so the sidebar route and the floating dock share one
  // conversation and one history read. getDashboardData is React-cached, so the
  // child pages still get their farm data without a second query.
  const initialMessages = await getRecentChat(farmer.id, 20);

  return (
    <LanguageProvider>
      <AssistantProvider
        farmerName={farmerName}
        initialMessages={initialMessages}
        suggestions={assistantSuggestions(farms)}
      >
        {/* data-shell scopes the deeper "New version" af-* palette to the app
            shell, leaving /login and /onboarding on the original emerald. */}
        <div data-shell="app" className="relative flex bg-af-bg min-h-screen text-af-ink">
          <AppBackground />
          <SpotlightLayer />
          <Sidebar />
          <div className="relative z-10 flex-1 min-w-0 flex flex-col">
            <TopBar farmerName={farmerName} farmerId={farmerId} />
            <main className="flex-1 px-6 lg:px-8 py-7">{children}</main>
            <AppFooter />
          </div>
          <AssistantDock />
          {/* Mounted on the shell, not inside the chat, so voice mode covers the
              screen whether it was opened from the dock or the assistant page. */}
          <VoiceMode />
        </div>
      </AssistantProvider>
    </LanguageProvider>
  );
}
