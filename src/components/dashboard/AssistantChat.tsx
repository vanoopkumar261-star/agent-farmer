"use client";

import { useEffect, useRef, useState } from "react";
import { Sparkles, Send, Brain, CloudSun, Sprout, User, Loader2 } from "lucide-react";
import { useT } from "@/components/i18n/LanguageProvider";

type Msg = { role: "user" | "assistant"; content: string };

const SUGGESTIONS = [
  "Is my crop on track?",
  "Should I irrigate today?",
  "Best fertilizer for my soil?",
  "What's the weather risk this week?",
];

const MEMORY_CHIPS = [
  { icon: User, label: "Profile" },
  { icon: Sprout, label: "Farms & crops" },
  { icon: CloudSun, label: "Live weather" },
  { icon: Brain, label: "Chat history" },
];

export default function AssistantChat({ farmerName }: { farmerName: string }) {
  const { locale } = useT();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, streaming]);

  async function send(text: string) {
    const content = text.trim();
    if (!content || streaming) return;

    const next: Msg[] = [...messages, { role: "user", content }];
    setMessages(next);
    setInput("");
    setStreaming(true);
    // placeholder assistant message we stream into
    setMessages((m) => [...m, { role: "assistant", content: "" }]);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next, locale }),
      });

      if (!res.ok || !res.body) {
        const errText = await res.text().catch(() => "");
        setMessages((m) => {
          const copy = [...m];
          copy[copy.length - 1] = {
            role: "assistant",
            content: errText || "Sorry, I couldn't reach the AI engine. Please try again.",
          };
          return copy;
        });
        return;
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
    } catch {
      setMessages((m) => {
        const copy = [...m];
        copy[copy.length - 1] = { role: "assistant", content: "Network error. Please try again." };
        return copy;
      });
    } finally {
      setStreaming(false);
    }
  }

  const empty = messages.length === 0;
  const waitingFirstToken =
    streaming && messages.length > 0 && messages[messages.length - 1].content === "";

  return (
    <div className="af-spotlight relative flex flex-col h-[calc(100vh-9rem)] rounded-2xl bg-af-card border border-af-border shadow-af-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-af-border">
        <span className="flex items-center justify-center w-10 h-10 rounded-xl bg-af-ai/10 text-af-ai">
          <Sparkles className="w-5 h-5" />
        </span>
        <div className="min-w-0">
          <div className="text-[15px] font-extrabold text-af-ink leading-tight">AI Assistant</div>
          <div className="text-[12px] text-af-muted">Memory-aware · knows your farm</div>
        </div>
        <div className="ml-auto hidden md:flex items-center gap-1.5">
          {MEMORY_CHIPS.map((c) => (
            <span
              key={c.label}
              className="inline-flex items-center gap-1 rounded-full bg-af-bg border border-af-border px-2.5 py-1 text-[10px] font-bold text-af-ink-2"
            >
              <c.icon className="w-3 h-3 text-af-primary" />
              {c.label}
            </span>
          ))}
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-6 space-y-4">
        {empty ? (
          <div className="h-full flex flex-col items-center justify-center text-center">
            <span className="flex items-center justify-center w-14 h-14 rounded-2xl bg-af-ai/10 text-af-ai">
              <Sparkles className="w-7 h-7" />
            </span>
            <h3 className="mt-4 text-xl font-extrabold text-af-ink">
              Hi {farmerName.split(" ")[0]}, how can I help?
            </h3>
            <p className="mt-1.5 text-sm text-af-muted max-w-sm">
              Ask me anything about your farms, crops, weather, or expenses. I remember your
              full context.
            </p>
            <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-2.5 w-full max-w-md">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="text-left rounded-[14px] bg-af-bg border border-af-border px-4 py-3 text-sm font-semibold text-af-ink-2 hover:border-af-ai/40 hover:text-af-ai transition"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((m, i) =>
            m.role === "user" ? (
              <div key={i} className="flex justify-end">
                <div className="max-w-[78%] rounded-2xl rounded-br-md bg-af-primary text-white px-4 py-2.5 text-[14px] leading-relaxed shadow-af-sm">
                  {m.content}
                </div>
              </div>
            ) : (
              <div key={i} className="flex items-start gap-3">
                <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-af-ai/10 text-af-ai shrink-0 mt-0.5">
                  <Sparkles className="w-4 h-4" />
                </span>
                <div className="max-w-[82%] rounded-2xl rounded-bl-md bg-af-bg border border-af-border px-4 py-2.5 text-[14px] text-af-ink leading-relaxed whitespace-pre-wrap">
                  {waitingFirstToken && i === messages.length - 1 ? (
                    <span className="inline-flex items-center gap-1 text-af-muted">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" /> Thinking…
                    </span>
                  ) : (
                    m.content
                  )}
                </div>
              </div>
            )
          )
        )}
      </div>

      {/* Input */}
      <div className="border-t border-af-border p-3">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
          className="flex items-center gap-2"
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask anything about your farm…"
            className="flex-1 rounded-[14px] bg-af-bg border border-af-border px-4 py-3 text-sm text-af-ink placeholder:text-af-muted outline-none focus:ring-2 focus:ring-af-ai/25 focus:border-af-ai/40 transition"
          />
          <button
            type="submit"
            disabled={!input.trim() || streaming}
            className="flex items-center justify-center w-11 h-11 rounded-[14px] bg-af-ai hover:bg-af-ai/90 text-white shrink-0 transition active:scale-95 disabled:opacity-40 disabled:pointer-events-none"
          >
            {streaming ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </form>
      </div>
    </div>
  );
}
