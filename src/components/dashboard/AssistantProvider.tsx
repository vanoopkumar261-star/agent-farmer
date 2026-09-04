"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";
import { useT } from "@/components/i18n/LanguageProvider";
import type { Locale } from "@/lib/i18n/config";

/** A citation the assistant drew on, surfaced under its reply. */
export type Source = {
  title: string;
  parent: string | null;
  link: string | null;
  source: "scheme" | "library" | "agronomy";
};

export type Msg = {
  role: "user" | "assistant";
  content: string;
  /** Set only on assistant turns that actually retrieved something. */
  sources?: Source[];
};

/**
 * The one and only assistant state for the whole dashboard.
 *
 * Both entry points — the sidebar route (/dashboard/assistant) and the floating
 * dock — render <AssistantChat/>, which reads from this context. That means one
 * message list, one streaming flag and one /api/chat call path no matter where
 * the farmer opens the assistant: send a message in the dock, navigate to the
 * full page, and the conversation is already there.
 */
type AssistantContextValue = {
  messages: Msg[];
  input: string;
  setInput: (v: string) => void;
  streaming: boolean;
  /**
   * Sends a message and resolves with the assistant's full reply.
   *
   * Voice mode needs the finished text so it can read it aloud, and it is the
   * only reliable way to get it — reading the last message off `messages`
   * afterwards races with React's batching.
   *
   * `localeOverride` pins the reply language. Voice mode passes "en" so the
   * answer comes back in the language the English voice can actually read,
   * even when the interface is set to Hindi or Tamil.
   */
  send: (text: string, localeOverride?: string) => Promise<string>;
  /**
   * The language the assistant replies in, chosen from inside the chat.
   *
   * Separate from the interface locale on purpose: a farmer may read the
   * dashboard in English and still want advice in Hindi. Null until they pick,
   * which is also what makes the language prompt show on an empty chat.
   *
   * Not persisted — the durable language setting is `af_locale` in
   * LanguageProvider, and a second stored language would give two answers to
   * "what language is this farmer in".
   */
  chatLocale: Locale | null;
  setChatLocale: (l: Locale | null) => void;
  farmerName: string;
  suggestions: string[];
  /** Floating-dock visibility. The route page ignores this. */
  isOpen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
  /** Hands-free voice conversation overlay. */
  voiceOpen: boolean;
  openVoice: () => void;
  closeVoice: () => void;
};

const AssistantContext = createContext<AssistantContextValue | null>(null);

export function useAssistant() {
  const ctx = useContext(AssistantContext);
  if (!ctx) throw new Error("useAssistant must be used inside <AssistantProvider>");
  return ctx;
}

export default function AssistantProvider({
  children,
  farmerName,
  initialMessages = [],
  suggestions = [],
}: {
  children: React.ReactNode;
  farmerName: string;
  initialMessages?: Msg[];
  suggestions?: string[];
}) {
  const { locale, t } = useT();
  const [messages, setMessages] = useState<Msg[]>(initialMessages);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [voiceOpen, setVoiceOpen] = useState(false);
  const [chatLocale, setChatLocale] = useState<Locale | null>(null);
  // Guards against a second send slipping through before `streaming` re-renders.
  const inFlight = useRef(false);

  const send = useCallback(
    async (text: string, localeOverride?: string): Promise<string> => {
      const content = text.trim();
      if (!content || inFlight.current) return "";
      inFlight.current = true;

      const next: Msg[] = [...messages, { role: "user", content }];
      setMessages(next);
      setInput("");
      setStreaming(true);
      // Placeholder assistant message we stream into.
      setMessages((m) => [...m, { role: "assistant", content: "" }]);

      const fail = (msg: string) => {
        setMessages((m) => {
          const copy = [...m];
          copy[copy.length - 1] = { role: "assistant", content: msg };
          return copy;
        });
        return msg;
      };

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          // Order matters: voice mode passes "en" explicitly and must still win
          // over a chat choice, or a farmer who picked Malayalam would get
          // spoken replies in a language the device voice cannot read.
          body: JSON.stringify({ messages: next, locale: localeOverride ?? chatLocale ?? locale }),
        });

        if (!res.ok || !res.body) {
          const errText = await res.text().catch(() => "");
          return fail(errText || t("assistant.error.unreachable"));
        }

        // Citations ride on a header because the body is a text stream. Absent
        // or empty means the knowledge base did not cover the question, which
        // is a real answer — the reply then carries no chips and makes no claim
        // to a source.
        let sources: Source[] = [];
        try {
          const raw = res.headers.get("X-Rag-Sources");
          if (raw) sources = JSON.parse(atob(raw)) as Source[];
        } catch {
          /* malformed header — show the answer without citations */
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let acc = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          acc += decoder.decode(value, { stream: true });
          setMessages((m) => {
            const copy = [...m];
            copy[copy.length - 1] = { role: "assistant", content: acc, sources };
            return copy;
          });
        }
        return acc;
      } catch {
        return fail(t("assistant.error.network"));
      } finally {
        setStreaming(false);
        inFlight.current = false;
      }
    },
    [messages, locale, chatLocale, t]
  );

  const value = useMemo<AssistantContextValue>(
    () => ({
      messages,
      input,
      setInput,
      streaming,
      send,
      chatLocale,
      setChatLocale,
      farmerName,
      suggestions,
      isOpen,
      open: () => setIsOpen(true),
      close: () => setIsOpen(false),
      toggle: () => setIsOpen((v) => !v),
      voiceOpen,
      openVoice: () => setVoiceOpen(true),
      closeVoice: () => setVoiceOpen(false),
    }),
    [messages, input, streaming, send, chatLocale, farmerName, suggestions, isOpen, voiceOpen]
  );

  return <AssistantContext.Provider value={value}>{children}</AssistantContext.Provider>;
}
