"use client";

import { useEffect } from "react";
import { Mic, Loader2, Volume2, X, VolumeX } from "lucide-react";
import { useAssistant } from "./AssistantProvider";
import { useT } from "@/components/i18n/LanguageProvider";
import { useVoiceConversation, type VoicePhase } from "@/hooks/useVoiceConversation";

/**
 * Hands-free voice conversation.
 *
 * One button opens this and the loop runs itself — listen, send, speak the
 * reply, listen again — until the farmer ends it. Everything said still lands
 * in the normal chat transcript underneath, so closing voice mode leaves a
 * readable conversation rather than something that vanished.
 */
export default function VoiceMode() {
  const { voiceOpen, closeVoice, send } = useAssistant();
  const { t } = useT();

  // No `locale` here on purpose — the loop is pinned to English end to end.
  const { phase, interim, lastQuestion, lastReply, error, begin, end, canSpeak } =
    useVoiceConversation({ send, active: voiceOpen });

  // The click that opened voice mode is the user gesture browsers require
  // before they will play synthesised speech, so start the loop right here.
  useEffect(() => {
    if (voiceOpen) begin();
    // `begin` is stable; re-running on every render would restart the mic.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voiceOpen]);

  useEffect(() => {
    if (!voiceOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        end();
        closeVoice();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [voiceOpen, end, closeVoice]);

  if (!voiceOpen) return null;

  const finish = () => {
    end();
    closeVoice();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t("voice.title")}
      className="fixed inset-0 z-[60] flex flex-col items-center justify-center bg-af-secondary px-6 py-10 text-white"
    >
      <button
        onClick={finish}
        aria-label={t("voice.end")}
        className="absolute top-5 right-5 flex items-center justify-center w-10 h-10 rounded-[12px] bg-white/10 text-white transition hover:bg-white/20 outline-none focus-visible:ring-2 focus-visible:ring-white/60"
      >
        <X className="w-5 h-5" />
      </button>

      {/* What the farmer just said — kept on screen so they can see it landed. */}
      <div className="w-full max-w-2xl min-h-[3.5rem] text-center">
        {(interim || lastQuestion) && (
          <p className="text-[15px] text-white/60">
            &ldquo;{interim || lastQuestion}&rdquo;
          </p>
        )}
      </div>

      <Orb phase={phase} />

      <p className="mt-6 font-mono text-[11px] tracking-[0.16em] uppercase text-af-sage">
        {phaseLabel(phase, t)}
      </p>

      {/* The reply. On the seven languages with no installed voice this IS the
          output, so it is sized to be read across a room, not as a caption. */}
      <div className="mt-6 w-full max-w-2xl min-h-[7rem] overflow-y-auto text-center">
        {lastReply && (
          <p className="text-[19px] leading-relaxed text-white whitespace-pre-wrap">{lastReply}</p>
        )}
      </div>

      {error && (
        <p className="mt-2 max-w-md text-center text-[13px] text-af-amber">{error}</p>
      )}

      {!canSpeak && (
        // justify-center keeps the icon beside the text; a `text-center` flex
        // row instead strands the icon at the far left of the container.
        <div className="mt-2 flex max-w-md items-start justify-center gap-2 text-[12px] text-white/55">
          <VolumeX className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <span className="text-left">{t("voice.noVoice")}</span>
        </div>
      )}

      <button
        onClick={finish}
        className="mt-8 rounded-[14px] bg-white/10 px-8 py-3 text-sm font-semibold text-white transition hover:bg-white/20 outline-none focus-visible:ring-2 focus-visible:ring-white/60"
      >
        {t("voice.end")}
      </button>

      <p className="mt-4 text-center text-[11px] text-white/40 max-w-sm">
        {t("voice.privacy")}
      </p>
    </div>
  );
}

/** State indicator — the one thing on screen that says what is happening. */
function Orb({ phase }: { phase: VoicePhase }) {
  const listening = phase === "listening";
  const speaking = phase === "speaking";
  const working = phase === "thinking" || phase === "transcribing";

  return (
    <div className="relative mt-8 flex items-center justify-center w-40 h-40">
      {/* Halo pulses only while the mic is actually open, so the farmer can
          tell at a glance whether it is their turn to talk. */}
      {listening && (
        <>
          <span className="absolute inset-0 rounded-full bg-af-leaf/25 animate-ping" />
          <span className="absolute inset-4 rounded-full bg-af-leaf/20 animate-pulse" />
        </>
      )}
      {speaking && <span className="absolute inset-2 rounded-full bg-af-sage/25 animate-pulse" />}

      <span
        className={`relative flex items-center justify-center w-28 h-28 rounded-full transition-colors duration-300 ${
          listening ? "bg-af-leaf" : speaking ? "bg-af-sage text-af-secondary" : "bg-white/15"
        }`}
      >
        {working ? (
          <Loader2 className="w-10 h-10 animate-spin text-white" />
        ) : speaking ? (
          <Volume2 className="w-10 h-10 text-af-secondary" />
        ) : (
          <Mic className="w-10 h-10 text-white" />
        )}
      </span>
    </div>
  );
}

function phaseLabel(phase: VoicePhase, t: (k: string) => string): string {
  switch (phase) {
    case "listening":
      return t("voice.listening");
    case "transcribing":
      return t("voice.transcribing");
    case "thinking":
      return t("voice.thinking");
    case "speaking":
      return t("voice.speaking");
    default:
      return t("voice.ready");
  }
}
