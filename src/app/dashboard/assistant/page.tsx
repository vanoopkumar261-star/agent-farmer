import AssistantChat from "@/components/dashboard/AssistantChat";
import { T } from "@/components/i18n/LanguageProvider";
import PageHeader from "@/components/ui/PageHeader";
import { Sparkles } from "lucide-react";

export const dynamic = "force-dynamic";

/**
 * Full-page entry point. The conversation, history and /api/chat call all live
 * in <AssistantProvider> up in the dashboard layout, so this route and the
 * floating dock are two windows onto the same assistant.
 */
export default function AssistantPage() {
  return (
    <div className="max-w-[1000px] mx-auto">
      <PageHeader
        icon={<Sparkles className="w-5 h-5" />}
        title={<T k="title.assistant" />}
        subtitle={<T k="assistant.subtitle" />}
      />
      <AssistantChat variant="page" />
    </div>
  );
}
