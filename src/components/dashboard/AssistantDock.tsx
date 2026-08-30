"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { Minus, X, MessageCircleQuestion } from "lucide-react";
import { useAssistant } from "./AssistantProvider";
import AssistantChat, { AssistantAvatar } from "./AssistantChat";
import { useT } from "@/components/i18n/LanguageProvider";

/**
 * Floating entry point to the assistant, available on every dashboard page.
 *
 * Owns no chat logic — it toggles visibility and renders the same
 * <AssistantChat/> the /dashboard/assistant route renders, backed by the same
 * <AssistantProvider> state. Hidden on the assistant route itself, where the
 * full-page version is already on screen.
 */
export default function AssistantDock() {
  const { isOpen, open, close, messages, send, suggestions } = useAssistant();
  const { t } = useT();
  const pathname = usePathname();
  const panelRef = useRef<HTMLDivElement>(null);
  const launcherRef = useRef<HTMLButtonElement>(null);

  const onAssistantPage = pathname === "/dashboard/assistant";

  // Esc closes the panel and returns focus to the launcher.
  useEffect(() => {
    if (!isOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        close();
        launcherRef.current?.focus();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, close]);

  // Move focus into the panel when it opens, so keyboard users land inside it.
  useEffect(() => {
    if (isOpen) panelRef.current?.querySelector("input")?.focus();
  }, [isOpen]);

  if (onAssistantPage) return null;

  return (
    <>
      {isOpen && (
        <div
          onClick={close}
          className="fixed inset-0 z-40 bg-af-ink/20 backdrop-blur-[2px]"
          aria-hidden="true"
        />
      )}

      {/* Panel — wide two-column on desktop, full-height sheet on mobile. */}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={t("assistant.dialogAria")}
        className={`fixed z-50 flex flex-col overflow-hidden rounded-[16px] border border-af-border bg-af-card shadow-af-float transition-all duration-200
          inset-x-3 bottom-3 top-14
          sm:inset-x-auto sm:top-auto sm:right-6 sm:bottom-24 sm:w-[860px] sm:max-w-[calc(100vw-3rem)] sm:h-[620px] sm:max-h-[calc(100vh-9rem)]
          ${isOpen ? "opacity-100 translate-y-0 pointer-events-auto" : "opacity-0 translate-y-3 pointer-events-none"}`}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-af-border shrink-0">
          <AssistantAvatar />
          <div className="min-w-0">
            <div className="text-[16px] font-semibold text-af-ink leading-tight">{t("assistant.title")}</div>
            <div className="text-[12px] text-af-muted">{t("assistant.tagline")}</div>
          </div>
          <div className="ml-auto flex items-center gap-1">
            <button
              onClick={close}
              aria-label={t("assistant.minimise")}
              className="flex items-center justify-center w-8 h-8 rounded-[10px] text-af-muted hover:text-af-ink hover:bg-af-bg transition outline-none focus-visible:ring-2 focus-visible:ring-af-primary/40"
            >
              <Minus className="w-4 h-4" />
            </button>
            <button
              onClick={close}
              aria-label={t("assistant.close")}
              className="flex items-center justify-center w-8 h-8 rounded-[10px] text-af-muted hover:text-af-ink hover:bg-af-bg transition outline-none focus-visible:ring-2 focus-visible:ring-af-primary/40"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 flex min-h-0">
          {/* "Try asking" rail — desktop only; the chat panel keeps its own
              suggestion grid for the empty state on narrow screens. */}
          <aside className="hidden md:flex w-[280px] shrink-0 flex-col border-r border-af-border bg-af-bg/50 p-5 overflow-y-auto">
            <h3 className="text-[15px] font-semibold text-af-ink">{t("assistant.tryAsking")}</h3>
            <div className="mt-4 flex flex-col gap-2">
              {suggestions.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="flex items-start gap-2.5 text-left rounded-[12px] bg-af-card border border-af-border px-3.5 py-3 text-meta font-semibold text-af-ink-2 hover:border-af-primary/40 hover:bg-af-sage/40 hover:text-af-secondary transition outline-none focus-visible:ring-2 focus-visible:ring-af-primary/40"
                >
                  <MessageCircleQuestion className="w-4 h-4 mt-0.5 text-af-muted shrink-0" />
                  {s}
                </button>
              ))}
            </div>
          </aside>

          <div className="flex-1 min-w-0">
            <AssistantChat variant="drawer" hideSuggestions={messages.length === 0} />
          </div>
        </div>
      </div>

      {/* Launcher */}
      <button
        ref={launcherRef}
        onClick={() => (isOpen ? close() : open())}
        aria-expanded={isOpen}
        aria-label={isOpen ? t("assistant.closeAria") : t("assistant.openAria")}
        className="group fixed bottom-6 right-6 z-50 flex items-center gap-2.5 rounded-[16px] bg-af-secondary py-2.5 pl-2.5 pr-4 shadow-af-float transition-all duration-150 hover:bg-af-primary-deep active:scale-[0.97] outline-none focus-visible:ring-2 focus-visible:ring-af-primary focus-visible:ring-offset-2"
      >
        {isOpen ? (
          <span className="flex items-center justify-center w-10 h-10 rounded-[12px] bg-white/10">
            <X className="w-5 h-5 text-white" />
          </span>
        ) : (
          <AssistantAvatar />
        )}
        <span className="hidden sm:flex flex-col items-start leading-tight">
          <span className="text-meta font-semibold text-white">{t("assistant.title")}</span>
          <span className="text-[10px] text-af-sage/75">{t("assistant.askMeAnything")}</span>
        </span>
        {!isOpen && (
          <span className="absolute -top-0.5 -left-0.5 w-3 h-3 rounded-full bg-af-leaf border-2 border-af-card" />
        )}
      </button>
    </>
  );
}
