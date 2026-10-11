/**
 * Entity-token scoring for transcriptions.
 *
 * Whole-sentence match is the wrong measure twice over. Whisper normalises
 * spoken numbers into digits ("two thousand" → "2,000"), so a word diff calls a
 * perfect transcription a failure; and our ground-truth sentences are
 * machine-authored, so their exact phrasing is not authoritative. What IS
 * authoritative is whether the spans the agent consumes survived: the amount,
 * the crop, the input, the command word.
 *
 * Tolerance is derived from the key's own length rather than hardcoded, so a
 * missing nukta or a single wrong vowel sign does not read as a lost entity,
 * and the scorer does not quietly overfit to one run's garbling.
 */

/** Strip combining marks and whitespace so diacritic slips are not misses. */
export const bare = (s) =>
  (s ?? "").normalize("NFD").replace(/\p{M}/gu, "").replace(/[\s .,!?;:।॥"'`()\-]/g, "").toLowerCase();

export function editDistance(a, b) {
  const m = a.length;
  const n = b.length;
  if (!m) return n;
  if (!n) return m;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[n];
}

/** Closest match for `needle` anywhere in `hay`, as an edit distance. */
function bestWindow(hay, needle) {
  if (!needle.length) return Infinity;
  if (hay.includes(needle)) return 0;
  let best = Infinity;
  const widths = [needle.length - 1, needle.length, needle.length + 1].filter((w) => w > 0);
  for (let i = 0; i < hay.length; i++) {
    for (const w of widths) {
      if (i + w > hay.length) continue;
      best = Math.min(best, editDistance(hay.slice(i, i + w), needle));
      if (best === 0) return 0;
    }
  }
  return best;
}

/**
 * Did any form in this key group survive?
 * @param {string} heard  the transcription
 * @param {string[]} forms  acceptable spellings, digits included
 */
export function keyHit(heard, forms) {
  const hay = bare(heard);
  let best = { ok: false, form: null, distance: Infinity };
  for (const form of forms) {
    const needle = bare(form);
    if (!needle) continue;
    const d = bestWindow(hay, needle);
    const tol = Math.max(1, Math.round(needle.length * 0.2));
    if (d <= tol && d < best.distance) best = { ok: true, form, distance: d };
    else if (d < best.distance) best = { ...best, distance: d };
  }
  return best;
}

/** Score one utterance: what fraction of its key groups survived. */
export function scoreUtterance(heard, keys) {
  const results = keys.map((forms) => ({ forms, ...keyHit(heard, forms) }));
  const hit = results.filter((r) => r.ok).length;
  return {
    hit,
    total: results.length,
    ratio: results.length ? Number((hit / results.length).toFixed(3)) : 0,
    missed: results.filter((r) => !r.ok).map((r) => r.forms[0]),
    results,
  };
}

/** Share of letters that fall inside the locale's expected Unicode block. */
export function scriptShare(text, range) {
  if (!range) return 1;
  const letters = [...(text ?? "")].filter((c) => /\p{L}/u.test(c));
  if (!letters.length) return 0;
  const inRange = letters.filter((c) => {
    const p = c.codePointAt(0);
    return p >= range[0] && p <= range[1];
  });
  return Number((inRange.length / letters.length).toFixed(2));
}

export const SCRIPT_RANGE = {
  en: null,
  hi: [0x900, 0x97f],
  mr: [0x900, 0x97f],
  kn: [0xc80, 0xcff],
  ta: [0xb80, 0xbff],
  te: [0xc00, 0xc7f],
  ml: [0xd00, 0xd7f],
  bn: [0x980, 0x9ff],
  pa: [0xa00, 0xa7f],
};
