"use client";

import { useEffect, useRef } from "react";
import { Send, Brain, CloudSun, Sprout, User, Loader2, Leaf, AudioLines } from "lucide-react";
import { useAssistant } from "./AssistantProvider";
import { useT } from "@/components/i18n/LanguageProvider";
import DictateButton from "./DictateButton";
import { voiceEnabledFor } from "@/lib/speech";
import SpeakButton from "./SpeakButton";

const MEMORY_CHIPS = [
  { icon: User, labelKey: "assistant.memoryChip.profile" },
  { icon: Sprout, labelKey: "assistant.memoryChip.farms" },
  { icon: CloudSun, labelKey: "assistant.memoryChip.weather" },
  { icon: Brain, labelKey: "assistant.memoryChip.history" },
];

/** Follow-up shortcuts shown once a conversation is under way. */
const QUICK_CHIP_KEYS = ["assistant.quickChip.irrigation", "assistant.quickChip.fertilizer", "assistant.quickChip.weather"];

/**
 * The Agent Farmer AI surface. Purely presentational — every message, the
 * streaming flag and the single /api/chat call live in <AssistantProvider>, so
 * the full-page route and the floating dock render this same component against
 * the same conversation.
 */
export default function AssistantChat({
  variant = "page",
  hideSuggestions = false,
}: {
  variant?: "page" | "drawer";
  /** Set when the dock's "Try asking" rail is already showing the suggestions. */
  hideSuggestions?: boolean;
}) {
  const { messages, input, setInput, streaming, send, farmerName, suggestions, openVoice } =
    useAssistant();
  const { t, locale } = useT();
  // Voice is English-only (see VOICE_LOCALES in lib/speech.ts). The text
  // assistant still works in all nine languages.
  const voiceEnabled = voiceEnabledFor(locale);
  const scrollRef = useRef<HTMLDivElement>(null);
  const drawer = variant === "drawer";

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, streaming]);

  const empty = messages.length === 0;
  const waitingFirstToken =
    streaming && messages.length > 0 && messages[messages.length - 1].content === "";

  return (
    <div
      className={
        drawer
          ? "flex flex-col h-full bg-af-card overflow-hidden"
          : "af-spotlight relative flex flex-col h-[calc(100vh-9rem)] rounded-2xl bg-af-card border border-af-border shadow-af-sm overflow-hidden"
      }
    >
      {/* Header — the dock renders its own, so page variant only. */}
      {!drawer && (
        <div className="flex items-center gap-3 px-5 py-4 border-b border-af-border shrink-0">
          <AssistantAvatar />
          <div className="min-w-0">
            <div className="text-[16px] font-semibold text-af-ink leading-tight">{t("assistant.title")}</div>
            <div className="text-[12px] text-af-muted">{t("assistant.tagline")}</div>
          </div>
          <div className="ml-auto hidden md:flex items-center gap-1.5">
            {MEMORY_CHIPS.map((c) => (
              <span
                key={c.labelKey}
                className="inline-flex items-center gap-1 rounded-full bg-af-bg border border-af-border px-2.5 py-1 text-[10px] font-semibold text-af-ink-2"
              >
                <c.icon className="w-3 h-3 text-af-primary" />
                {t(c.labelKey)}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-6 space-y-4">
        {empty ? (
          <div className="h-full flex flex-col items-center justify-center text-center">
            <span className="flex items-center justify-center w-14 h-14 rounded-2xl bg-af-beige border border-af-border">
              <Leaf className="w-7 h-7 text-af-primary-deep" />
            </span>
            <h3 className="mt-4 text-[19px] font-semibold tracking-[-0.02em] text-af-ink">
              {t("assistant.greeting", { name: farmerName.split(" ")[0] })}
            </h3>
            <p className="mt-1.5 text-sm text-af-ink-2 max-w-sm">
              {t("assistant.greetingBody")}
            </p>
            {!hideSuggestions && (
              <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-2.5 w-full max-w-md">
                {suggestions.map((s) => (
                  <button
                    key={s}
                    onClick={() => send(s)}
                    className="text-left rounded-[14px] bg-af-bg border border-af-border px-4 py-3 text-sm font-semibold text-af-ink-2 hover:border-af-primary/45 hover:bg-af-sage/40 hover:text-af-secondary transition outline-none focus-visible:ring-2 focus-visible:ring-af-primary/45"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          messages.map((m, i) =>
            m.role === "user" ? (
              <div key={i} className="flex justify-end">
                <div className="max-w-[78%] rounded-2xl rounded-br-md bg-af-sage text-af-secondary px-4 py-2.5 text-[14px] font-medium leading-relaxed">
                  {m.content}
                </div>
              </div>
            ) : (
              <div key={i} className="flex items-start gap-3">
                <span className="flex items-center justify-center w-8 h-8 rounded-full bg-af-sage text-af-primary-deep shrink-0 mt-0.5">
                  <Leaf className="w-4 h-4" />
                </span>
                <div className="flex items-end gap-1 max-w-[82%]">
                  <div className="rounded-2xl rounded-bl-md bg-af-bg border border-af-border px-4 py-2.5 text-[14px] text-af-ink leading-relaxed whitespace-pre-wrap min-w-0">
                    {waitingFirstToken && i === messages.length - 1 ? (
                      <span className="inline-flex items-center gap-1 text-af-muted">
                        <Loader2 className="w-3.5 h-3.5 animate-spin" /> {t("assistant.thinking")}
                      </span>
                    ) : (
                      m.content
                    )}
                  </div>
                  {/* Renders nothing when this language has no installed voice. */}
                  {!streaming && m.content && <SpeakButton text={m.content} />}
                </div>
              </div>
            )
          )
        )}
      </div>

      {/* Follow-up chips — only once there's something to follow up on. */}
      {!empty && (
        <div className="px-5 pb-1 flex flex-wrap gap-2 shrink-0">
          {QUICK_CHIP_KEYS.map((k) => (
            <button
              key={k}
              onClick={() => send(t(k))}
              disabled={streaming}
              className="rounded-full bg-af-card border border-af-border px-3.5 py-1.5 text-[12px] font-semibold text-af-ink-2 hover:border-af-primary/45 hover:text-af-secondary transition outline-none focus-visible:ring-2 focus-visible:ring-af-primary/40 disabled:opacity-50"
            >
              {t(k)}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="p-3 shrink-0">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
          className="flex items-center gap-2 rounded-[16px] bg-af-card border border-af-border p-1.5 pl-3 focus-within:border-af-primary/40 focus-within:ring-2 focus-within:ring-af-primary/15 transition"
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={t("assistant.inputPlaceholder")}
            className="flex-1 bg-transparent py-2.5 text-sm text-af-ink placeholder:text-af-muted outline-none"
          />
          <DictateButton
            disabled={streaming}
            onText={(text) =>
              setInput(input.trim() ? `${input.trim()} ${text}` : text)
            }
          />
          {voiceEnabled && (
            <button
              type="button"
              onClick={openVoice}
              disabled={streaming}
              aria-label={t("voice.start")}
              title={t("voice.start")}
              className="flex items-center justify-center w-10 h-10 rounded-full text-af-muted shrink-0 transition hover:bg-af-sage hover:text-af-secondary active:scale-95 outline-none focus-visible:ring-2 focus-visible:ring-af-primary/45 disabled:opacity-40 disabled:pointer-events-none"
            >
              <AudioLines className="w-4 h-4" />
            </button>
          )}
          <button
            type="submit"
            disabled={!input.trim() || streaming}
            aria-label={t("assistant.sendAria")}
            className="flex items-center justify-center w-10 h-10 rounded-full bg-af-secondary hover:bg-af-primary-deep text-white shrink-0 transition active:scale-95 outline-none focus-visible:ring-2 focus-visible:ring-af-primary/45 focus-visible:ring-offset-2 disabled:opacity-40 disabled:pointer-events-none"
          >
            {streaming ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </form>
        <p className="mt-2 text-center text-[11px] text-af-muted">
          {t("assistant.disclaimer")}
        </p>
      </div>
    </div>
  );
}

/**
 * Leaf-in-circuit mark — an agricultural intelligence agent, not a support rep.
 * Inline SVG so the circuit traces sit behind the leaf at the right weight.
 */
export function AssistantAvatar({ className = "w-10 h-10" }: { className?: string }) {
  return (
    <span
      className={`relative flex items-center justify-center rounded-[12px] bg-af-primary shrink-0 overflow-hidden ${className}`}
    >
      <svg viewBox="0 0 40 40" className="absolute inset-0 w-full h-full" aria-hidden="true">
        <g stroke="#04331F" strokeWidth="1.4" opacity="0.42" fill="none">
          <path d="M0 12 H8 V4" />
          <path d="M40 27 H32 V36" />
          <path d="M0 30 H6" />
          <path d="M40 9 H34" />
        </g>
        <g fill="#04331F" opacity="0.5">
          <circle cx="8" cy="4" r="1.6" />
          <circle cx="32" cy="36" r="1.6" />
          <circle cx="6" cy="30" r="1.4" />
          <circle cx="34" cy="9" r="1.4" />
        </g>
      </svg>
      <Leaf className="relative w-5 h-5 text-white" strokeWidth={2.2} />
    </span>
  );
}
