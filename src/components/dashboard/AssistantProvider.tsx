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
import { LOCALES, type Locale } from "@/lib/i18n/config";

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
  /**
   * The language this reply was written in. Stored per message because the
   * farmer can change language mid-conversation, and the speaker button has to
   * read each reply in the language it was actually written in — reading an
   * earlier Hindi answer with a Kannada voice is gibberish.
   */
  locale?: Locale;
};

/**
 * The assistant marks a language switch with a leading `[[lang:kn]]`, because
 * the farmer asks for it in words ("now talk to me in Kannada") rather than
 * reaching for a menu. The tag is stripped here and never reaches the screen.
 */
const LANG_TAG = /^\s*\[\[lang:([a-z]{2})\]\]/i;
/** Longest prefix of the tag we might be holding when a chunk splits mid-tag. */
const TAG_MAX = 14;

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
  /**
   * The farmer's own profile id, for the voice agent's tool executor.
   *
   * Needed because a voice-originated write goes through the browser's
   * RLS-scoped session, exactly like the manual expense form — the agent
   * gateway never sees an id and never touches the database. See
   * src/lib/agent/tools.ts.
   */
  farmerId: string;
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
  farmerId,
  initialMessages = [],
  suggestions = [],
}: {
  children: React.ReactNode;
  farmerName: string;
  farmerId: string;
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

      // The error is shown in the thread, but resolves as "" — it is not a
      // reply, and voice mode would otherwise summarise it and read it out.
      const fail = (msg: string) => {
        setMessages((m) => {
          const copy = [...m];
          copy[copy.length - 1] = { role: "assistant", content: msg };
          return copy;
        });
        return "";
      };

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          // Order matters: voice mode passes "en" explicitly and must still win
          // over a chat choice, or a farmer who picked Malayalam would get
          // spoken replies in a language the device voice cannot read.
          // Only the recent turns: the route reads the last 10 and nothing more, and
          // sending the whole thread pushed long Hindi chats past its size limit.
          body: JSON.stringify({ messages: next.slice(-10), locale: localeOverride ?? chatLocale ?? locale }),
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
        // Which language this reply is in, until a [[lang:xx]] tag says otherwise.
        let replyLocale = (localeOverride ?? chatLocale ?? locale) as Locale;
        let tagHandled = false;
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          acc += decoder.decode(value, { stream: true });

          if (!tagHandled) {
            const m = acc.match(LANG_TAG);
            if (m) {
              const code = m[1].toLowerCase();
              acc = acc.slice(m[0].length).trimStart();
              tagHandled = true;
              if (LOCALES.some((l) => l.code === code)) {
                replyLocale = code as Locale;
                // Persist it, so the NEXT question is answered in it too.
                setChatLocale(code as Locale);
              }
            } else if (acc.trimStart().length >= TAG_MAX || !"[[lang:".startsWith(acc.trimStart().slice(0, 7))) {
              // Long enough, or clearly not a tag — stop holding back the text.
              tagHandled = true;
            } else {
              // Possibly a tag split across chunks; wait for more before painting.
              continue;
            }
          }

          const content = acc;
          setMessages((m) => {
            const copy = [...m];
            copy[copy.length - 1] = { role: "assistant", content, sources, locale: replyLocale };
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
      farmerId,
      suggestions,
      isOpen,
      open: () => setIsOpen(true),
      close: () => setIsOpen(false),
      toggle: () => setIsOpen((v) => !v),
      voiceOpen,
      openVoice: () => setVoiceOpen(true),
      closeVoice: () => setVoiceOpen(false),
    }),
    [messages, input, streaming, send, chatLocale, farmerName, farmerId, suggestions, isOpen, voiceOpen]
  );

  return <AssistantContext.Provider value={value}>{children}</AssistantContext.Provider>;
}
