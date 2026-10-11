"use client";

import { Volume2, Square, Loader2, VolumeX } from "lucide-react";
import { useT } from "@/components/i18n/LanguageProvider";
import { useTextToSpeech } from "@/hooks/useTextToSpeech";

/**
 * Plays one assistant reply aloud in the language it was written in.
 *
 * `locale` is the language of the reply (the chat language), not necessarily
 * the interface language. Shows a spinner while the first sentence is being
 * synthesised, a stop square while playing, and a muted speaker when the voice
 * server could not be reached, so the farmer knows why nothing happened.
 */
export default function SpeakButton({ text, locale }: { text: string; locale: string }) {
  const { t } = useT();
  const { speak, cancel, unlock, speaking, loading, failed } = useTextToSpeech(locale);

  if (!text.trim()) return null;

  const label = failed ? t("voice.unavailable") : speaking ? t("voice.stop") : t("voice.playReply");

  return (
    <button
      type="button"
      onClick={() => {
        if (speaking) return cancel();
        unlock(); // inside the click, for the autoplay policy
        void speak(text);
      }}
      aria-label={label}
      title={label}
      className="inline-flex items-center justify-center w-7 h-7 rounded-lg text-af-muted transition hover:bg-af-sage hover:text-af-secondary outline-none focus-visible:ring-2 focus-visible:ring-af-primary/40 shrink-0"
    >
      {loading ? (
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
      ) : speaking ? (
        <Square className="w-3.5 h-3.5" />
      ) : failed ? (
        <VolumeX className="w-4 h-4" />
      ) : (
        <Volume2 className="w-4 h-4" />
      )}
    </button>
  );
}
