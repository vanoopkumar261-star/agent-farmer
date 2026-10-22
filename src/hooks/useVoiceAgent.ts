"use client";

import { useCallback, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useT } from "@/components/i18n/LanguageProvider";
import { matchLocalCommand } from "@/lib/agent/localCommands";
import { describeScreen } from "@/lib/agent/screen";
import { executeToolCall, undoLastAction } from "@/lib/agent/tools";

/**
 * The voice agent's decision layer: three tiers, cheapest first.
 *
 *   1  local commands   A deterministic phrase table (15 navigation intents
 *                       plus undo and repeat, in all nine locales) tried on
 *                       the transcript before any model call. Instant and
 *                       free. See src/lib/agent/localCommands.ts.
 *   2  the gateway      POST /api/agent/turn, which returns either a reply or
 *                       a tool call. The route has existed since the mobile
 *                       app was built; nothing on the web ever called it.
 *   3  fall through     Return null and the ordinary chat answers, keeping
 *                       RAG, the citation chips and the chat transcript.
 *
 * ── Why tier 3 matters ───────────────────────────────────────────────────────
 *
 * It would be simpler to route every voice turn through the gateway, which is
 * what the mobile app does. On the web that would be a regression: /api/chat
 * streams, retrieves from the handbooks, shows its sources, and writes both
 * sides into the visible thread. So the gateway is asked ONLY to spot an
 * action, and anything that is really a question is handed back to the chat
 * that was already answering it well.
 *
 * The cost of that choice is one extra model call on a turn that turns out to
 * be a question. It is bounded — the gateway caps history at six messages and
 * 600 tokens — and it buys a farmer being able to say "I spent two thousand
 * on fertilizer" and have it recorded rather than explained.
 */

type Handled = string | null;

export function useVoiceAgent({
  farmerId,
  closeVoice,
}: {
  farmerId: string;
  /** Voice mode must close before a navigation, or the farmer lands behind the overlay. */
  closeVoice: () => void;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { t } = useT();

  // What was last said, so "repeat" has something to repeat. Deliberately a
  // ref and not state: nothing renders from it, and re-rendering the voice
  // overlay mid-turn restarts the microphone.
  const lastSpokenRef = useRef<string>("");

  const remember = (s: string) => {
    lastSpokenRef.current = s;
    return s;
  };

  const handleTranscript = useCallback(
    async (text: string, locale: string): Promise<Handled> => {
      /* ── Tier 1: local commands ─────────────────────────────────────────── */
      const local = matchLocalCommand(text, locale);

      if (local?.type === "repeat") {
        return lastSpokenRef.current || t("agent.nothingToRepeat");
      }

      if (local?.type === "undo") {
        const res = await undoLastAction(t);
        return remember(res.ok ? res.spoken : res.reason);
      }

      if (local?.type === "navigate") {
        // Close first: a push under an open overlay leaves the farmer looking
        // at the voice screen while the page they asked for loads behind it.
        closeVoice();
        router.push(local.route);
        return remember(t("agent.opening", { screen: t(`agent.screen.${local.intent}`) }));
      }

      /* ── Tier 2: the gateway ────────────────────────────────────────────── */
      try {
        const res = await fetch("/api/agent/turn", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: [{ role: "user", content: text }],
            locale,
            screenSummary: describeScreen(pathname),
          }),
        });
        if (!res.ok) return null; // rate-limited, out of quota, offline — let chat try
        const data = await res.json();

        if (data?.toolCall?.name) {
          const result = await executeToolCall(data.toolCall, farmerId, t);
          return remember(result.ok ? result.spoken : result.reason);
        }

        // A plain reply means the gateway judged this a question, not an
        // action. Hand it back so the real assistant answers it with its
        // handbooks and its sources, rather than spending this thinner answer.
        return null;
      } catch {
        return null;
      }
    },
    [farmerId, closeVoice, router, pathname, t]
  );

  return { handleTranscript };
}
