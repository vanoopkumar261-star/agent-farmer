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

export type Msg = { role: "user" | "assistant"; content: string };

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
          body: JSON.stringify({ messages: next, locale: localeOverride ?? locale }),
        });

        if (!res.ok || !res.body) {
          const errText = await res.text().catch(() => "");
          return fail(errText || t("assistant.error.unreachable"));
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
            copy[copy.length - 1] = { role: "assistant", content: acc };
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
    [messages, locale, t]
  );

  const value = useMemo<AssistantContextValue>(
    () => ({
      messages,
      input,
      setInput,
      streaming,
      send,
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
    [messages, input, streaming, send, farmerName, suggestions, isOpen, voiceOpen]
  );

  return <AssistantContext.Provider value={value}>{children}</AssistantContext.Provider>;
}
