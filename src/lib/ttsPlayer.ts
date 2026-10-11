/**
 * The one place audio replies are played from.
 *
 * Speech comes from /api/tts, which proxies the Chatterbox Indic server in
 * `ml/tts/`. That model has no streaming mode — a request returns a whole WAV —
 * so a long reply would be silent until every word was synthesised. Instead the
 * text is cut into sentences, the first chunk is kept short so sound starts
 * quickly, and the next chunk is fetched while the current one plays.
 *
 * This is a module-level singleton on purpose. Every speaker button, the
 * onboarding read-aloud and voice mode share one <audio> element, so two things
 * can never talk over each other, and the element is "unlocked" once inside a
 * click so Safari lets later chunks play after their network round-trip.
 */

export type PlayerStatus = "idle" | "loading" | "playing";

export interface PlayerSnapshot {
  /** Who started the current speech — lets each button show only its own state. */
  owner: symbol | null;
  status: PlayerStatus;
  /** Locale whose last synthesis failed; cleared after a cool-off or on success. */
  failedLocale: string | null;
}

let snapshot: PlayerSnapshot = { owner: null, status: "idle", failedLocale: null };
const listeners = new Set<() => void>();

function set(patch: Partial<PlayerSnapshot>) {
  snapshot = { ...snapshot, ...patch };
  listeners.forEach((fn) => fn());
}

export const subscribe = (fn: () => void) => {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
};
export const getSnapshot = () => snapshot;
export const getServerSnapshot = (): PlayerSnapshot => ({ owner: null, status: "idle", failedLocale: null });

/* ───────────────────────────────── chunking ─────────────────────────────── */

// Sized from measured speed: Chatterbox runs at roughly real time on an
// RTX 5060 (~5s to synthesise a 45-character Hindi sentence), so a chunk's
// length is also very nearly how long the farmer waits for it. The first chunk
// is therefore kept to about one short sentence — it sets the delay before any
// sound at all — while later chunks are synthesised during playback of the one
// before and can afford to be bigger.
const FIRST_CHUNK_MAX = 70;
const CHUNK_MAX = 160;

/**
 * Cuts text into speakable chunks: sentence boundaries first (including the
 * Devanagari danda ।॥ used by Hindi, Marathi and Bengali), and a sentence
 * longer than the cap is broken at a comma or a space rather than mid-word.
 *
 * The first chunk is always left on its own so it stays short; from the second
 * onward, consecutive sentences are packed together up to the cap.
 */
export function chunkForSpeech(text: string): string[] {
  const sentences = text
    .replace(/\s+/g, " ")
    .trim()
    .split(/(?<=[.!?।॥])\s+/)
    .filter(Boolean);

  const pieces: string[] = [];
  for (const s of sentences) {
    let rest = s;
    // The cap tightens for the very first piece and relaxes after it.
    for (;;) {
      const cap = pieces.length === 0 ? FIRST_CHUNK_MAX : CHUNK_MAX;
      if (rest.length <= cap) break;
      const min = Math.floor(cap / 3); // don't leave a scrap of a few words
      let cut = rest.lastIndexOf(", ", cap);
      if (cut < min) cut = rest.lastIndexOf(" ", cap);
      if (cut < min) cut = cap;
      pieces.push(rest.slice(0, cut + 1).trim());
      rest = rest.slice(cut + 1).trim();
    }
    if (rest) pieces.push(rest);
  }

  const chunks: string[] = [];
  for (const p of pieces) {
    const last = chunks[chunks.length - 1];
    // `>= 2` keeps chunk one alone; anything later may absorb a short sentence.
    if (chunks.length >= 2 && last.length + 1 + p.length <= CHUNK_MAX) {
      chunks[chunks.length - 1] = `${last} ${p}`;
    } else {
      chunks.push(p);
    }
  }
  return chunks;
}

/* ───────────────────────────────── playback ─────────────────────────────── */

// A zero-length WAV. Playing it inside a click is what lifts the autoplay lock.
const SILENT_WAV =
  "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=";

let audio: HTMLAudioElement | null = null;
let runId = 0;
let aborters = new Set<AbortController>();
let failTimer: ReturnType<typeof setTimeout> | null = null;

function getAudio(): HTMLAudioElement {
  if (!audio) audio = new Audio();
  return audio;
}

/** Call synchronously from a click/tap handler. Safe to call repeatedly. */
export function unlock() {
  if (typeof window === "undefined") return;
  const el = getAudio();
  if (!el.paused || el.src) return;
  el.src = SILENT_WAV;
  void el.play().catch(() => {});
}

function markFailed(locale: string) {
  set({ failedLocale: locale });
  if (failTimer) clearTimeout(failTimer);
  // Try again after a minute — the server may simply have been starting up.
  failTimer = setTimeout(() => set({ failedLocale: null }), 60_000);
}

async function fetchChunk(text: string, locale: string, signal: AbortSignal): Promise<Blob | null> {
  try {
    const res = await fetch("/api/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, locale }),
      signal,
    });
    if (!res.ok) return null;
    return await res.blob();
  } catch {
    return null;
  }
}

function playBlob(blob: Blob, run: number): Promise<void> {
  return new Promise((resolve) => {
    const el = getAudio();
    const url = URL.createObjectURL(blob);
    const finish = () => {
      el.onended = null;
      el.onerror = null;
      URL.revokeObjectURL(url);
      resolve();
    };
    el.onended = finish;
    el.onerror = finish;
    el.src = url;
    if (run !== runId) return finish();
    el.play().catch(finish);
  });
}

/** Stops everything: playback, and any chunks still being synthesised. */
export function cancel() {
  runId += 1;
  aborters.forEach((a) => a.abort());
  aborters = new Set();
  if (audio) {
    // Resolves any pending playBlob via its onended/onerror handlers.
    const pending = audio.onended;
    audio.pause();
    pending?.call(audio, new Event("ended"));
  }
  set({ owner: null, status: "idle" });
}

/**
 * Speaks `text`. Resolves when playback ends, is cancelled, or fails — voice
 * mode awaits this before reopening the microphone, otherwise the assistant
 * transcribes its own voice.
 */
export async function speak(owner: symbol, text: string, locale: string): Promise<void> {
  const chunks = chunkForSpeech(text);
  if (chunks.length === 0) return;

  unlock(); // still inside the caller's gesture if there is one
  cancel();
  const run = runId;
  set({ owner, status: "loading", failedLocale: null });

  const start = (i: number) => {
    const ctl = new AbortController();
    aborters.add(ctl);
    return fetchChunk(chunks[i], locale, ctl.signal).finally(() => aborters.delete(ctl));
  };

  let next = start(0);
  for (let i = 0; i < chunks.length; i++) {
    const blob = await next;
    if (run !== runId) return;
    if (!blob) {
      markFailed(locale);
      set({ owner: null, status: "idle" });
      return;
    }
    // Synthesise the following chunk while this one plays.
    if (i + 1 < chunks.length) next = start(i + 1);
    set({ owner, status: "playing" });
    await playBlob(blob, run);
    if (run !== runId) return;
  }
  set({ owner: null, status: "idle" });
}
