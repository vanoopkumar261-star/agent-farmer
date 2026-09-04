import { checkRateLimit, rateLimited } from "@/lib/rateLimit";
import { safeHttpUrl, resolvesToPublicHost } from "@/lib/apiInput";

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
 *
 * ── It is also an SSRF surface, and used not to defend itself ───────────────
 * The URL is caller-supplied and this route is unauthenticated, so "fetch
 * whatever you are given" meant an anonymous request could make the server hit
 * the cloud metadata endpoint or anything on the internal network. Scheme
 * validation alone never addressed that. Every hop is now resolved and checked
 * against private, loopback, link-local and reserved space before it is
 * fetched, and redirects are followed manually so the destination is validated
 * too rather than trusted because the first host looked reasonable.
 */
const MAX_REDIRECTS = 3;
const MAX_BYTES = 5 * 1024 * 1024;
const TIMEOUT_MS = 8000;

export async function GET(req: Request) {
  const rl = await checkRateLimit(req, "img");
  if (!rl.ok) return rateLimited(rl);

  const target = safeHttpUrl(new URL(req.url).searchParams.get("u"));
  if (!target || !target.startsWith("https://")) {
    return new Response("Bad image URL", { status: 400 });
  }

  if (!(await resolvesToPublicHost(target))) {
    return new Response("Bad image URL", { status: 400 });
  }

  let upstream: Response;
  let url = target;
  try {
    for (let hop = 0; ; hop++) {
      upstream = await fetch(url, {
        // Manual, so a redirect cannot carry us somewhere unvalidated.
        redirect: "manual",
        signal: AbortSignal.timeout(TIMEOUT_MS),
        headers: { Accept: "image/*" },
        // Don't forward cookies or the caller's headers.
        cache: "no-store",
      });

      if (upstream.status < 300 || upstream.status >= 400) break;

      const location = upstream.headers.get("location");
      if (!location || hop >= MAX_REDIRECTS) {
        return new Response("Too many redirects", { status: 502 });
      }

      const next = safeHttpUrl(new URL(location, url).toString());
      if (!next || !next.startsWith("https://") || !(await resolvesToPublicHost(next))) {
        return new Response("Bad redirect target", { status: 400 });
      }
      url = next;
    }
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
