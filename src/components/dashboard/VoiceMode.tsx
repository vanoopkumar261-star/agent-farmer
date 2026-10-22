"use client";

import { useEffect } from "react";
import { Mic, Loader2, Volume2, X, VolumeX } from "lucide-react";
import { useAssistant } from "./AssistantProvider";
import { useT } from "@/components/i18n/LanguageProvider";
import type { Locale } from "@/lib/i18n/config";
import { useVoiceChat, type VoicePhase } from "@/hooks/useVoiceChat";
import { useVoiceAgent } from "@/hooks/useVoiceAgent";

/**
 * Full voice chat.
 *
 * One button opens this and the loop runs itself — listen, send, speak the
 * reply, listen again — until the farmer ends it. The farmer speaks, and is
 * answered aloud, in the language they chose for the chat. Everything said still
 * lands in the normal chat transcript underneath, so closing voice mode leaves
 * a readable conversation rather than something that vanished.
 */
export default function VoiceMode() {
  const { voiceOpen, closeVoice, send, chatLocale, setChatLocale, farmerId } = useAssistant();
  const { t, locale } = useT();

  // Navigation commands, undo, and the tool-calling gateway. Returns a
  // sentence when it handled the turn, or null to let the chat answer.
  const { handleTranscript } = useVoiceAgent({ farmerId, closeVoice });

  const { phase, level, lastQuestion, lastReply, error, begin, end, interrupt, voiceFailed } =
    useVoiceChat({
      send,
      active: voiceOpen,
      locale: chatLocale ?? locale,
      // Speaking Hindi to an English chat (or the reverse) switches the chat too.
      onLanguageHeard: (heard) => setChatLocale(heard as Locale),
      handleTranscript,
    });
  const canSpeak = !voiceFailed;

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
        {lastQuestion && (
          <p className="text-[15px] text-white/80">&ldquo;{lastQuestion}&rdquo;</p>
        )}
      </div>

      <Orb phase={phase} level={level} onTap={interrupt} label={t("a11y.voiceTap")} />

      <p className="mt-6 font-mono text-[11px] tracking-[0.16em] uppercase text-af-ondark-ink">
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
        <div className="mt-2 flex max-w-md items-start justify-center gap-2 text-[12px] text-white/75">
          <VolumeX className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <span className="text-left">{t("voice.unavailable")}</span>
        </div>
      )}

      <button
        onClick={finish}
        className="mt-8 rounded-[14px] bg-white/10 px-8 py-3 text-sm font-semibold text-white transition hover:bg-white/20 outline-none focus-visible:ring-2 focus-visible:ring-white/60"
      >
        {t("voice.end")}
      </button>

      <p className="mt-4 text-center text-[11px] text-white/70 max-w-sm">
        {t("voice.privacy")}
      </p>
    </div>
  );
}

/** State indicator — the one thing on screen that says what is happening. */
function Orb({ phase, level, onTap, label }: { phase: VoicePhase; level: number; onTap: () => void; label: string }) {
  const listening = phase === "listening";
  const speaking = phase === "speaking";
  const working = phase === "thinking" || phase === "transcribing";

  return (
    <button
      type="button"
      onClick={onTap}
      disabled={!listening && !speaking}
      aria-label={label}
      className="relative mt-8 flex items-center justify-center w-40 h-40 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-white/60 disabled:cursor-default"
    >
      {/* The halo follows the microphone level, so the farmer sees they are
          being heard — and can tell at a glance whether it is their turn. */}
      {listening && (
        <span
          className="absolute inset-0 rounded-full bg-af-ondark-orb/30 transition-transform duration-100"
          style={{ transform: `scale(${0.7 + level * 0.3})` }}
        />
      )}
      {speaking && <span className="absolute inset-2 rounded-full bg-af-ondark-ink/25 animate-pulse" />}

      <span
        className={`relative flex items-center justify-center w-28 h-28 rounded-full transition-colors duration-300 ${
          listening ? "bg-af-ondark-orb" : speaking ? "bg-af-ondark-ink text-af-ondark-deep" : "bg-white/15"
        }`}
      >
        {working ? (
          <Loader2 className="w-10 h-10 animate-spin text-white" />
        ) : speaking ? (
          <Volume2 className="w-10 h-10 text-af-ondark-deep" />
        ) : (
          <Mic className="w-10 h-10 text-white" />
        )}
      </span>
    </button>
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
