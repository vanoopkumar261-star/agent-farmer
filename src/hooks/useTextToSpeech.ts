"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  getVoiceFor,
  onVoicesChanged,
  speechSynthesisSupported,
} from "@/lib/speech";

/** Which engine will actually produce sound for the current language. */
export type SpeechSource = "device" | "server" | "none";

/**
 * Reads text aloud in the farmer's current language, over a two-tier chain.
 *
 *   1. Device voice via `speechSynthesis` — instant, offline, free.
 *   2. Otherwise POST /api/tts, which runs Meta's MMS-TTS in `ml/server.py`.
 *
 * Device first is deliberate: it needs no server and no network, and where a
 * real voice exists (Google हिन्दी, en-IN Ravi) it sounds better than MMS. The
 * server exists to cover the seven languages that have no installed voice at
 * all on desktop Windows — previously those were simply silent.
 *
 * `source` lets the UI tell "will speak" from "cannot speak" without guessing.
 * It is optimistic about the server: we cannot know it is reachable until we
 * try, so `speak()` degrades quietly if the request fails.
 */
export function useTextToSpeech(locale: string) {
  const [hasDeviceVoice, setHasDeviceVoice] = useState(false);
  const [serverFailed, setServerFailed] = useState(false);
  const [speaking, setSpeaking] = useState(false);

  // Held so cancel() can detach handlers before aborting, otherwise `onend`
  // fires during teardown and flips `speaking` back on for the next utterance.
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const objectUrlRef = useRef<string | null>(null);

  // The voice list arrives asynchronously, so re-check on `voiceschanged`
  // as well as on mount and whenever the language changes.
  useEffect(() => {
    if (!speechSynthesisSupported()) {
      setHasDeviceVoice(false);
      return;
    }
    const check = () => setHasDeviceVoice(getVoiceFor(locale) !== null);
    check();
    return onVoicesChanged(check);
  }, [locale]);

  // A new language deserves a fresh attempt at the server.
  useEffect(() => setServerFailed(false), [locale]);

  const releaseAudio = useCallback(() => {
    const audio = audioRef.current;
    if (audio) {
      audio.onended = null;
      audio.onerror = null;
      audio.pause();
      audioRef.current = null;
    }
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
  }, []);

  /** Stops whichever engine is talking. Both paths, always. */
  const cancel = useCallback(() => {
    if (speechSynthesisSupported()) {
      const u = utteranceRef.current;
      if (u) {
        u.onend = null;
        u.onerror = null;
        utteranceRef.current = null;
      }
      window.speechSynthesis.cancel();
    }
    releaseAudio();
    setSpeaking(false);
  }, [releaseAudio]);

  /** Tier 1 — the device's own voice. */
  const speakOnDevice = useCallback(
    (text: string, voice: SpeechSynthesisVoice) =>
      new Promise<void>((resolve) => {
        const synth = window.speechSynthesis;

        const enqueue = () => {
          const utterance = new SpeechSynthesisUtterance(text);
          utterance.voice = voice;
          utterance.lang = voice.lang;
          utterance.rate = 0.98; // a touch slower reads better for advice
          utterance.pitch = 1;

          const done = () => {
            utteranceRef.current = null;
            setSpeaking(false);
            resolve();
          };
          utterance.onend = done;
          utterance.onerror = done;

          utteranceRef.current = utterance;
          setSpeaking(true);
          synth.resume();
          synth.speak(utterance);
        };

        // Chrome silently drops an utterance queued in the same tick as
        // cancel(), so only cancel when something is actually playing and give
        // the engine a tick to settle before queueing the replacement.
        if (synth.speaking || synth.pending) {
          cancel();
          setTimeout(enqueue, 60);
        } else {
          enqueue();
        }
      }),
    [cancel]
  );

  /** Tier 2 — WAV synthesised by the local MMS-TTS server. */
  const speakFromServer = useCallback(
    async (text: string) => {
      let blob: Blob;
      try {
        const res = await fetch("/api/tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text, locale }),
        });
        if (!res.ok) {
          // 503 means the Python server isn't running. Stop trying for this
          // language so every reply doesn't pay the round-trip to find out.
          if (res.status === 503) setServerFailed(true);
          return;
        }
        blob = await res.blob();
      } catch {
        setServerFailed(true);
        return;
      }

      await new Promise<void>((resolve) => {
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        objectUrlRef.current = url;
        audioRef.current = audio;

        const done = () => {
          releaseAudio();
          setSpeaking(false);
          resolve();
        };
        audio.onended = done;
        audio.onerror = done;

        setSpeaking(true);
        // Autoplay can still refuse if no gesture preceded this; treat a
        // rejection as "did not speak" rather than leaving the promise hanging.
        audio.play().catch(done);
      });
    },
    [locale, releaseAudio]
  );

  /**
   * Speaks `text`, resolving when playback finishes (or immediately when
   * nothing can speak). The voice loop awaits this before reopening the
   * microphone — resolving early reintroduces the bug where the assistant
   * transcribes its own reply and talks to itself.
   */
  const speak = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;

      cancel();

      const voice = speechSynthesisSupported() ? getVoiceFor(locale) : null;
      if (voice) {
        await speakOnDevice(trimmed, voice);
        return;
      }
      if (!serverFailed) await speakFromServer(trimmed);
    },
    [locale, serverFailed, cancel, speakOnDevice, speakFromServer]
  );

  /**
   * Satisfies the autoplay policy. Browsers only allow audio after a user
   * gesture, so voice mode calls this from the button press that opens it.
   */
  const unlock = useCallback(() => {
    if (!speechSynthesisSupported()) return;
    // A single space, not an empty string — Chrome never fires `onend` for an
    // empty utterance, which leaves the queue wedged and mutes everything after.
    const u = new SpeechSynthesisUtterance(" ");
    u.volume = 0;
    window.speechSynthesis.speak(u);
  }, []);

  // Never leave a voice talking after the component goes away.
  useEffect(() => cancel, [cancel]);

  const source: SpeechSource = hasDeviceVoice ? "device" : serverFailed ? "none" : "server";

  return {
    speak,
    cancel,
    unlock,
    speaking,
    source,
    /** True when something is expected to produce sound. */
    available: source !== "none",
  };
}
