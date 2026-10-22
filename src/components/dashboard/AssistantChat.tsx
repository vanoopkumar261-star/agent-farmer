"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { Send, Brain, CloudSun, Sprout, User, Loader2, Leaf, AudioLines, BookOpen, Check, Languages } from "lucide-react";
import { ThinkingOrb } from "thinking-orbs";
import { useAssistant } from "./AssistantProvider";
import { useT } from "@/components/i18n/LanguageProvider";
import { LOCALES, type Locale } from "@/lib/i18n/config";
import dynamic from "next/dynamic";
import { toSpeakableText } from "@/lib/plainText";

/**
 * The Markdown renderer is ~56KB and only earns its place once a reply exists.
 * Loading it statically put ~12KB on EVERY dashboard page, because the floating
 * assistant dock is mounted in the shell — cost paid on pages nobody opens the
 * chat on, by farmers on phones.
 *
 * The fallback is the reply with its syntax stripped rather than nothing, so
 * the words are readable from the first frame and simply gain formatting when
 * the chunk arrives — no flash of asterisks, no empty bubble.
 */
const AssistantMarkdown = dynamic(() => import("./AssistantMarkdown"), { ssr: false });
import SpeakButton from "./SpeakButton";
import { localeFromScript } from "@/lib/speech";

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
  const { messages, input, setInput, streaming, send, farmerName, suggestions, openVoice, chatLocale, setChatLocale } =
    useAssistant();
  const { t, locale } = useT();
  // Replies are written in the chat language, so that is the language they are
  // read aloud in.
  const replyLocale = chatLocale ?? locale;
  const [langOpen, setLangOpen] = useState(false);
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
            {/* The assistant's opening turn. Deliberately NOT pushed into
                `messages`: anything in there is replayed to /api/chat as
                conversation history, and the model would then see a question
                the farmer never asked. This is presentational only, styled to
                match an assistant bubble. */}
            <div className="w-full max-w-md text-left">
              <div className="flex items-start gap-3">
                <span className="flex items-center justify-center w-8 h-8 rounded-full bg-af-sage text-af-primary-deep shrink-0 mt-0.5">
                  <Leaf className="w-4 h-4" />
                </span>
                <div className="min-w-0 flex-1">
                  {chatLocale === null ? (
                    <>
                      <div className="rounded-2xl rounded-bl-md bg-af-bg border border-af-border px-4 py-2.5 text-[14px] text-af-ink leading-relaxed">
                        {t("assistant.langPrompt")}
                      </div>
                      {/* Native scripts, so the choice is legible to someone
                          who cannot read the interface language. Wraps rather
                          than scrolls — the floating dock is narrow. */}
                      <div className="mt-2.5 flex flex-wrap gap-2">
                        {LOCALES.map((l) => (
                          <button
                            key={l.code}
                            type="button"
                            onClick={() => setChatLocale(l.code as Locale)}
                            className="rounded-full bg-af-bg border border-af-border px-3.5 py-2 text-[13px] font-semibold text-af-ink-2 hover:border-af-primary/45 hover:bg-af-sage/40 hover:text-af-secondary transition outline-none focus-visible:ring-2 focus-visible:ring-af-primary/45"
                          >
                            {l.label}
                          </button>
                        ))}
                      </div>
                    </>
                  ) : (
                    <div className="flex flex-wrap items-center gap-2 text-[13px]">
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-af-sage border border-af-border px-3 py-1.5 font-semibold text-af-secondary">
                        <Check className="w-3.5 h-3.5" />
                        {t("assistant.langSet", {
                          lang: LOCALES.find((l) => l.code === chatLocale)?.label ?? chatLocale,
                        })}
                      </span>
                      <button
                        type="button"
                        onClick={() => setChatLocale(null)}
                        className="font-semibold text-af-muted hover:text-af-primary underline underline-offset-2 transition outline-none focus-visible:ring-2 focus-visible:ring-af-primary/45 rounded"
                      >
                        {t("assistant.langChange")}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <h3 className="mt-7 text-[19px] font-semibold tracking-[-0.02em] text-af-ink">
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
                <div className="max-w-[82%] min-w-0">
                  <div className="flex items-end gap-1">
                    <div className="rounded-2xl rounded-bl-md bg-af-bg border border-af-border px-4 py-2.5 text-[14px] text-af-ink leading-relaxed min-w-0">
                      {waitingFirstToken && i === messages.length - 1 ? (
                        <span className="inline-flex items-center gap-1.5 text-af-muted">
                          <ThinkingOrb state="solving" size={20} theme="auto" /> {t("assistant.thinking")}
                        </span>
                      ) : (
                        /* Markdown, not raw text. `whitespace-pre-wrap` is gone
                           with it: Markdown supplies its own paragraphs and
                           lists, and preserving the source newlines on top of
                           that double-spaces every reply. */
                        <Suspense fallback={<span className="whitespace-pre-wrap">{toSpeakableText(m.content)}</span>}>
                          <AssistantMarkdown>{m.content}</AssistantMarkdown>
                        </Suspense>
                      )}
                    </div>
                    {/* `m.locale` is the language this reply was actually
                        written in, which is not always the current one — the
                        farmer can switch mid-conversation. Replies restored
                        from history predate that record, so fall back to
                        reading the script rather than assuming. */}
                    {!streaming && m.content && (
                      <SpeakButton
                        text={toSpeakableText(m.content)}
                        locale={m.locale ?? localeFromScript(m.content, replyLocale)}
                      />
                    )}
                  </div>

                  {/* Where the answer came from. Absent when the knowledge base
                      did not cover the question — no chips is itself honest,
                      and means the reply is the model's own general knowledge. */}
                  {!streaming && m.sources && m.sources.length > 0 && (
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      <span className="font-mono text-[9px] font-semibold tracking-[0.14em] uppercase text-af-muted">
                        {t("rag.basedOn")}
                      </span>
                      {m.sources.map((src, k) => {
                        const label = src.parent ? `${src.parent} · ${src.title}` : src.title;
                        const chip =
                          "inline-flex items-center gap-1 rounded-full border border-af-border bg-af-card px-2.5 py-1 text-[11px] text-af-ink-2 hover:border-af-primary/40 hover:text-af-ink transition";
                        return src.link ? (
                          <a
                            key={k}
                            href={src.link}
                            target={src.link.startsWith("http") ? "_blank" : undefined}
                            rel={src.link.startsWith("http") ? "noopener noreferrer" : undefined}
                            className={chip}
                          >
                            <BookOpen className="w-3 h-3 shrink-0" />
                            {label}
                          </a>
                        ) : (
                          <span key={k} className={chip}>
                            <BookOpen className="w-3 h-3 shrink-0" />
                            {label}
                          </span>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )
          )
        )}
      </div>

      {/* Follow-up chips — only once there's something to follow up on. */}
      {!empty && (
        <div className="px-5 pb-1 flex flex-wrap gap-2 shrink-0">
          {/* The language is changeable for the whole conversation, not just at
              the start. Asking in words ("talk to me in Kannada") works too and
              is what most farmers will do, but a farmer who cannot write the
              request still needs a control they can press. */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setLangOpen((v) => !v)}
              aria-expanded={langOpen}
              className="inline-flex items-center gap-1.5 rounded-full bg-af-sage border border-af-border px-3.5 py-1.5 text-[12px] font-semibold text-af-secondary hover:border-af-primary/45 transition outline-none focus-visible:ring-2 focus-visible:ring-af-primary/40"
            >
              <Languages className="w-3.5 h-3.5" />
              {LOCALES.find((l) => l.code === replyLocale)?.label ?? replyLocale}
            </button>
            {langOpen && (
              <div className="absolute bottom-full left-0 z-20 mb-2 w-max max-w-[18rem] rounded-[14px] border border-af-border bg-af-card p-2 shadow-af-sm">
                <div className="flex flex-wrap gap-1.5">
                  {LOCALES.map((l) => (
                    <button
                      key={l.code}
                      type="button"
                      onClick={() => {
                        setChatLocale(l.code as Locale);
                        setLangOpen(false);
                      }}
                      className={`rounded-full border px-3 py-1.5 text-[12px] font-semibold transition outline-none focus-visible:ring-2 focus-visible:ring-af-primary/45 ${
                        l.code === replyLocale
                          ? "border-af-primary/45 bg-af-sage text-af-secondary"
                          : "border-af-border bg-af-bg text-af-ink-2 hover:border-af-primary/45 hover:text-af-secondary"
                      }`}
                    >
                      {l.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
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
          {/* The one voice control: a full spoken conversation. Replies can
              also be played individually from the speaker under each one. */}
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
          <button
            type="submit"
            disabled={!input.trim() || streaming}
            aria-label={t("assistant.sendAria")}
            className="flex items-center justify-center w-10 h-10 rounded-full bg-af-secondary hover:bg-af-primary-deep text-af-on-primary shrink-0 transition active:scale-95 outline-none focus-visible:ring-2 focus-visible:ring-af-primary/45 focus-visible:ring-offset-2 disabled:opacity-40 disabled:pointer-events-none"
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
        <g className="text-af-secondary" stroke="currentColor" strokeWidth="1.4" opacity="0.42" fill="none">
          <path d="M0 12 H8 V4" />
          <path d="M40 27 H32 V36" />
          <path d="M0 30 H6" />
          <path d="M40 9 H34" />
        </g>
        <g className="text-af-secondary" fill="currentColor" opacity="0.5">
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
