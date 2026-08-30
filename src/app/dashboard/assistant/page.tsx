import AssistantChat from "@/components/dashboard/AssistantChat";
import { T } from "@/components/i18n/LanguageProvider";

export const dynamic = "force-dynamic";

/**
 * Full-page entry point. The conversation, history and /api/chat call all live
 * in <AssistantProvider> up in the dashboard layout, so this route and the
 * floating dock are two windows onto the same assistant.
 */
export default function AssistantPage() {
  return (
    <div className="max-w-[1000px] mx-auto">
      <div className="mb-5">
        <h1 className="text-heading font-semibold text-af-ink">
          <T k="title.assistant" />
        </h1>
        <p className="mt-1 text-sm text-af-ink-2">
          <T k="assistant.subtitle" />
        </p>
      </div>
      <AssistantChat variant="page" />
    </div>
  );
}
