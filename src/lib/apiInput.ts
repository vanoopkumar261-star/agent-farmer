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
/**
 * Address ranges a proxied request must never reach.
 *
 * `safeHttpUrl` below only ever checked the *scheme*, which meant `/api/img`
 * would happily fetch `https://169.254.169.254/` — the cloud metadata
 * endpoint — or anything on the internal network, on behalf of an anonymous
 * caller. The content-type gate limited what came back, but status codes and
 * timing still made it a working internal port scanner.
 */
const BLOCKED_V4: [number, number][] = (
  [
    ["0.0.0.0", 8], // "this network"
    ["10.0.0.0", 8], // RFC1918
    ["100.64.0.0", 10], // CGNAT
    ["127.0.0.0", 8], // loopback
    ["169.254.0.0", 16], // link-local — cloud metadata lives here
    ["172.16.0.0", 12], // RFC1918
    ["192.0.0.0", 24], // IETF protocol assignments
    ["192.168.0.0", 16], // RFC1918
    ["198.18.0.0", 15], // benchmarking
    ["224.0.0.0", 4], // multicast
    ["240.0.0.0", 4], // reserved / broadcast
  ] as [string, number][]
).map(([addr, bits]) => {
  const n = addr.split(".").reduce((acc, o) => (acc << 8) + Number(o), 0) >>> 0;
  const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
  return [n & mask, mask] as [number, number];
});

function isBlockedAddress(ip: string, family: number): boolean {
  if (family === 4) {
    const parts = ip.split(".");
    if (parts.length !== 4) return true;
    const n = parts.reduce((acc, o) => (acc << 8) + Number(o), 0) >>> 0;
    return BLOCKED_V4.some(([net, mask]) => (n & mask) === net);
  }

  const v6 = ip.toLowerCase().split("%")[0];
  // IPv4-mapped addresses must be judged on the embedded IPv4 address, and they
  // arrive in two spellings. `new URL()` normalises `::ffff:127.0.0.1` to
  // `::ffff:7f00:1`, so checking only the dotted form let the hex form through —
  // which is a working loopback/metadata bypass, not a cosmetic gap.
  const dotted = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(v6);
  if (dotted) return isBlockedAddress(dotted[1], 4);

  const hex = /^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/.exec(v6);
  if (hex) {
    const hi = parseInt(hex[1], 16);
    const lo = parseInt(hex[2], 16);
    return isBlockedAddress(
      [hi >> 8, hi & 0xff, lo >> 8, lo & 0xff].join("."),
      4
    );
  }
  if (v6 === "::" || v6 === "::1") return true;
  if (/^f[cd][0-9a-f]{2}:/.test(v6) || /^f[cd][0-9a-f]{0,2}$/.test(v6)) return true; // ULA fc00::/7
  if (/^fe[89ab]/.test(v6)) return true; // link-local fe80::/10
  return false;
}

/**
 * True when the URL's hostname resolves to something a server-side fetch is
 * allowed to reach. Rejects private, loopback, link-local and reserved space.
 *
 * Residual risk, stated rather than hidden: this resolves the name and then
 * `fetch` resolves it again, so a DNS entry that changes between the two calls
 * (rebinding) is not covered. Closing that needs connecting to the validated
 * IP with an explicit Host header, which `fetch` does not expose. This blocks
 * every direct and redirect-based attempt, which is the realistic attack.
 */
export async function resolvesToPublicHost(rawUrl: string): Promise<boolean> {
  let host: string;
  try {
    host = new URL(rawUrl).hostname;
  } catch {
    return false;
  }
  // A bare IP literal needs no lookup — check it directly.
  const literal = host.replace(/^\[|\]$/g, "");
  if (/^\d+\.\d+\.\d+\.\d+$/.test(literal)) return !isBlockedAddress(literal, 4);
  if (literal.includes(":")) return !isBlockedAddress(literal, 6);

  try {
    const { lookup } = await import("node:dns/promises");
    const records = await lookup(host, { all: true });
    if (records.length === 0) return false;
    // Every answer must be public: one private record is enough to abuse.
    return records.every((r) => !isBlockedAddress(r.address, r.family));
  } catch {
    return false;
  }
}

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
