import "server-only";

/**
 * Input guards shared by the API routes.
 *
 * The AI endpoints take no authentication and interpolate caller-supplied
 * strings straight into Groq prompts, so "how big and what shape is this body"
 * has to be answered before any expensive work starts — a caller stuffing a
 * megabyte of text into a field is both a token-bill attack and a prompt
 * injection vector. These helpers keep that check in one place.
 */

export class PayloadTooLargeError extends Error {
  constructor() {
    super("Request body too large");
    this.name = "PayloadTooLargeError";
  }
}

/**
 * Reads and parses a JSON body, refusing anything past `maxBytes` first — by
 * the Content-Length header, then by the actual text length (the header is a
 * hint, not a guarantee).
 */
export async function readJsonBounded(req: Request, maxBytes = 32_000): Promise<any> {
  const declared = Number(req.headers.get("content-length") ?? 0);
  if (Number.isFinite(declared) && declared > maxBytes) throw new PayloadTooLargeError();

  const text = await req.text();
  if (text.length > maxBytes) throw new PayloadTooLargeError();
  return text ? JSON.parse(text) : {};
}

/** The 413 to return when `readJsonBounded` throws. */
export function payloadTooLarge(): Response {
  return Response.json({ error: "Request body too large." }, { status: 413 });
}

/** Any value → a trimmed string of at most `max` characters. */
export function clampStr(v: unknown, max: number): string {
  if (typeof v !== "string") return "";
  const s = v.trim();
  return s.length > max ? s.slice(0, max) : s;
}

/** Any value → an array of at most `max` items (non-arrays become `[]`). */
export function clampArr<T = unknown>(v: unknown, max: number): T[] {
  return Array.isArray(v) ? (v.slice(0, max) as T[]) : [];
}

/**
 * Returns the URL only if it parses and uses http/https — so a `javascript:`
 * or `data:` URL from a spoofed upstream feed never reaches an `href` or a
 * server-side `fetch`.
 */
export function safeHttpUrl(v: unknown): string | null {
  if (typeof v !== "string" || !v) return null;
  try {
    const u = new URL(v);
    return u.protocol === "http:" || u.protocol === "https:" ? u.toString() : null;
  } catch {
    return null;
  }
}

/**
 * CSRF backstop for the unauthenticated mutating routes.
 *
 * `SameSite=Lax` session cookies already block cross-site form posts; this also
 * covers `fetch`/XHR from another origin. A browser sets `Origin` honestly on
 * cross-site requests and an attacker page cannot forge it, so comparing it to
 * the host the request actually arrived on is enough. Requests with neither
 * `Origin` nor `Referer` (curl, server-to-server) are allowed — the rate
 * limiter and honeypot still apply there.
 */
export function isSameOrigin(req: Request): boolean {
  const host = req.headers.get("host");
  if (!host) return true;

  const origin = req.headers.get("origin");
  if (origin) {
    try {
      return new URL(origin).host === host;
    } catch {
      return false;
    }
  }

  const referer = req.headers.get("referer");
  if (referer) {
    try {
      return new URL(referer).host === host;
    } catch {
      return false;
    }
  }

  return true;
}
