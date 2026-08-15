"use client";

import { Volume2, Square } from "lucide-react";
import { useT } from "@/components/i18n/LanguageProvider";
import { useTextToSpeech } from "@/hooks/useTextToSpeech";
import { VOICE_LOCALE, voiceEnabledFor } from "@/lib/speech";

/**
 * Plays one assistant reply aloud, in English.
 *
 * Hidden entirely when the app is in another language. Voice is scoped to
 * English on purpose (see VOICE_LOCALES in lib/speech.ts) — and since replies
 * follow the UI language, a Tamil reply read by an English voice would be
 * gibberish. Hiding the control is the honest option.
 */
export default function SpeakButton({ text }: { text: string }) {
  const { locale, t } = useT();
  // Always the English voice — reading a Tamil reply with an English voice
  // would be gibberish, so the control is hidden outside English instead.
  const { speak, cancel, speaking, available } = useTextToSpeech(VOICE_LOCALE);

  if (!voiceEnabledFor(locale) || !available || !text.trim()) return null;

  return (
    <button
      type="button"
      onClick={() => (speaking ? cancel() : void speak(text))}
      aria-label={speaking ? t("voice.stop") : t("voice.playReply")}
      title={speaking ? t("voice.stop") : t("voice.playReply")}
      className="inline-flex items-center justify-center w-7 h-7 rounded-lg text-af-muted transition hover:bg-af-sage hover:text-af-secondary outline-none focus-visible:ring-2 focus-visible:ring-af-primary/40 shrink-0"
    >
      {speaking ? <Square className="w-3.5 h-3.5" /> : <Volume2 className="w-4 h-4" />}
    </button>
  );
}
