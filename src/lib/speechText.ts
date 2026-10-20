/**
 * Server-side guards for spoken replies, shared by every TTS engine behind
 * /api/tts.
 *
 * Two jobs:
 *   1. `speakableFor` rewrites the symbols chat replies are full of — "2‑3",
 *      "टन/हैक्टेयर", "40 %" — into words. Neural TTS models read symbols
 *      unpredictably, and an unreadable token is a common trigger for the
 *      model losing its place and repeating a syllable.
 *   2. `wavSeconds` / `trimWav` catch the case where it loops anyway: audio
 *      far longer than its text could need is retried, then cut, so a stuck
 *      model can never play the same word for a minute.
 */

const WORDS: Record<string, { or: string; per: string; to: string; percent: string }> = {
  hi: { or: "या", per: "प्रति", to: "से", percent: "प्रतिशत" },
  en: { or: "or", per: "per", to: "to", percent: "percent" },
};

/**
 * Abbreviations the models keep writing even when told not to, spelt out.
 * The voice reads "N-P-K" as noise and "pH" as "P बेच"; these are fixed here
 * rather than trusted to the prompt, because the prompt does not hold.
 */
// Latin abbreviations only match as whole tokens ((?<![A-Za-z]) … (?![A-Za-z]));
// \b would not do, since it treats Devanagari as a non-word character.
const ABBREVIATIONS: Record<string, [RegExp, string][]> = {
  hi: [
    [/(?<![A-Za-z])N\s*[-‑]?\s*P\s*[-‑]?\s*K(?![A-Za-z])/g, "नाइट्रोजन, फॉस्फोरस और पोटाश"],
    [/एन\s*पी\s*के|एनपीके/g, "नाइट्रोजन, फॉस्फोरस और पोटाश"],
    [/(?<![A-Za-z])pH(?![A-Za-z])/g, "पी एच"],
    [/(\d)\s*kg(?![A-Za-z])/gi, "$1 किलो"],
    [/(\d)\s*cm(?![A-Za-z])/gi, "$1 सेंटीमीटर"],
    [/(\d)\s*mm(?![A-Za-z])/gi, "$1 मिलीमीटर"],
    [/(\d)\s*ha(?![A-Za-z])/gi, "$1 हेक्टेयर"],
    [/(\d)\s*सेमी/g, "$1 सेंटीमीटर"],
  ],
  en: [[/(?<![A-Za-z])N\s*-?\s*P\s*-?\s*K(?![A-Za-z])/g, "nitrogen, phosphorus and potassium"]],
};

export function speakableFor(text: string, locale: string): string {
  const w = WORDS[locale] ?? WORDS.en;
  for (const [re, said] of ABBREVIATIONS[locale] ?? []) text = text.replace(re, said);
  return (
    text
      // Non-breaking / figure dashes the model has no reading for.
      .replace(/[‐‑‒–—−]/g, "-")
      // Numeric ranges: "2-3" → "2 से 3".
      .replace(/(\d)\s*-\s*(\d)/g, `$1 ${w.to} $2`)
      // A spaced dash is a pause, not a word — read aloud it came out as a stray "ए".
      .replace(/\s+-+\s+/g, ", ")
      .replace(/^\s*-+\s*/gm, "")
      // Brackets are a pause too; an opening one was heard as a stray vowel.
      .replace(/\s*[()[\]]\s*/g, ", ")
      .replace(/(\d)\s*%/g, `$1 ${w.percent}`)
      // A spaced slash separates alternatives; a tight one between words is a unit ratio.
      .replace(/\s+\/\s+/g, ` ${w.or} `)
      .replace(/(\S)\/(\S)/g, `$1 ${w.per} $2`)
      // Remaining word-joining hyphens ("हल-बाजू") read best as a pause-free space.
      .replace(/(\S)-(\S)/g, "$1 $2")
      .replace(/\s+/g, " ")
      .replace(/(,\s*)+([,.;!?।])/g, "$2")
      .replace(/(,\s*){2,}/g, ", ")
      .replace(/^[,\s]+|[,\s]+$/g, "")
      .trim()
  );
}

/** Ceiling on how long `text` may take to say: 8 chars/s (Chatterbox runs ~9, Magpie ~13-16) plus 2s slack. */
export function maxSpeechSeconds(text: string): number {
  return text.length / 8 + 2;
}

function dataChunk(buf: Buffer): { byteRate: number; offset: number; size: number } | null {
  if (buf.length < 44 || buf.toString("ascii", 0, 4) !== "RIFF") return null;
  const byteRate = buf.readUInt32LE(28);
  let off = 12;
  while (off + 8 <= buf.length) {
    const id = buf.toString("ascii", off, off + 4);
    const size = buf.readUInt32LE(off + 4);
    if (id === "data") return { byteRate, offset: off + 8, size: Math.min(size, buf.length - off - 8) };
    off += 8 + size + (size % 2);
  }
  return null;
}

/** Duration of a PCM WAV, or null when it isn't one we can read. */
export function wavSeconds(audio: ArrayBuffer): number | null {
  const d = dataChunk(Buffer.from(audio));
  return d && d.byteRate ? d.size / d.byteRate : null;
}

/** The WAV cut to `seconds`, headers rewritten to match. */
export function trimWav(audio: ArrayBuffer, seconds: number): ArrayBuffer {
  const buf = Buffer.from(audio);
  const d = dataChunk(buf);
  if (!d) return audio;
  const blockAlign = buf.readUInt16LE(32) || 1;
  const keep = Math.min(d.size, Math.floor((seconds * d.byteRate) / blockAlign) * blockAlign);
  const out = Buffer.from(buf.subarray(0, d.offset + keep));
  out.writeUInt32LE(out.length - 8, 4);
  out.writeUInt32LE(keep, d.offset - 4);
  return out.buffer.slice(out.byteOffset, out.byteOffset + out.length);
}
