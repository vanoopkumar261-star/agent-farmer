"use client";

import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";
import * as player from "@/lib/ttsPlayer";

/**
 * Reads text aloud in the farmer's language using the Chatterbox Indic voice
 * (via /api/tts → ml/tts). The audio engine is a shared singleton in
 * `lib/ttsPlayer`, so this hook only reports the state that belongs to *this*
 * caller: a speaker button on one message does not light up when another
 * message is playing.
 */
export function useTextToSpeech(locale: string) {
  const snap = useSyncExternalStore(player.subscribe, player.getSnapshot, player.getServerSnapshot);
  const owner = useRef<symbol>(Symbol("tts-owner"));

  const mine = snap.owner === owner.current;

  const speak = useCallback(
    // `as` speaks in another language than the hook's, e.g. the one voice
    // mode just heard the farmer use.
    (text: string, as: string = locale) => player.speak(owner.current, text, as),
    [locale]
  );

  const cancel = useCallback(() => {
    // Only stop our own speech; another surface's playback is not ours to kill.
    if (player.getSnapshot().owner === owner.current) player.cancel();
  }, []);

  // Never leave a voice talking after the component goes away.
  useEffect(() => cancel, [cancel]);

  return {
    speak,
    cancel,
    /** Call inside the click that starts speech, for the autoplay policy. */
    unlock: player.unlock,
    speaking: mine && snap.status !== "idle",
    /** True between the request and the first sound. */
    loading: mine && snap.status === "loading",
    /** The voice server could not be reached for this language recently. */
    failed: snap.failedLocale === locale,
    available: snap.failedLocale !== locale,
  };
}
