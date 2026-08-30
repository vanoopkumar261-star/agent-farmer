import { checkRateLimit, rateLimited } from "@/lib/rateLimit";
import { safeHttpUrl } from "@/lib/apiInput";

export const dynamic = "force-dynamic";

/**
 * Image proxy for third-party pictures the app displays — currently the news
 * feed's article thumbnails, whose URLs come from an external provider and
 * point at arbitrary hosts.
 *
 * Rendering `<img src="https://some-news-cdn/...">` straight into the dashboard
 * leaks the viewer's IP and the dashboard `Referer` to that host and bypasses
 * every CSP `img-src` narrowing. Routing them through here means the browser
 * only ever talks to our origin; the CSP can then be `img-src 'self' ...`.
 *
 * Constraints: https only, 24 h cache, 5 MB ceiling, and the upstream must
 * actually return an image content-type.
 */
const MAX_BYTES = 5 * 1024 * 1024;
const TIMEOUT_MS = 8000;

export async function GET(req: Request) {
  const rl = await checkRateLimit(req, "img");
  if (!rl.ok) return rateLimited(rl);

  const target = safeHttpUrl(new URL(req.url).searchParams.get("u"));
  if (!target || !target.startsWith("https://")) {
    return new Response("Bad image URL", { status: 400 });
  }

  let upstream: Response;
  try {
    upstream = await fetch(target, {
      redirect: "follow",
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { Accept: "image/*" },
      // Don't forward cookies or the caller's headers.
      cache: "no-store",
    });
  } catch {
    return new Response("Upstream fetch failed", { status: 502 });
  }

  const type = upstream.headers.get("content-type") ?? "";
  if (!upstream.ok || !type.startsWith("image/")) {
    return new Response("Not an image", { status: 415 });
  }

  const declaredLen = Number(upstream.headers.get("content-length") ?? 0);
  if (declaredLen && declaredLen > MAX_BYTES) {
    return new Response("Image too large", { status: 413 });
  }

  const buf = new Uint8Array(await upstream.arrayBuffer());
  if (buf.byteLength > MAX_BYTES) {
    return new Response("Image too large", { status: 413 });
  }

  return new Response(buf, {
    status: 200,
    headers: {
      "Content-Type": type,
      "Content-Length": String(buf.byteLength),
      "Cache-Control": "public, max-age=86400, s-maxage=86400, immutable",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
    },
  });
}
