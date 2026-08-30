/** @type {import('next').NextConfig} */

/*
 * Content-Security-Policy — pragmatic tier.
 *
 * `script-src` keeps `'unsafe-inline'` because Next's App Router injects inline
 * bootstrap/hydration scripts and this build has no nonce plumbing yet (that is
 * a planned follow-up). It still blocks every external script origin, which is
 * the bulk of the value. `style-src` allows inline because framer-motion,
 * Recharts and Leaflet all set `style=` attributes at runtime.
 *
 * Third-party origins that must stay allowed:
 *   fonts.googleapis.com / fonts.gstatic.com  — Google Fonts <link> on the
 *                                               /jaivik-sathi pages
 *   *.supabase.co (+ wss)                      — the browser auth client and
 *                                               signed leaf-scan image URLs
 *   img-src https:                             — news/article images and OSM map
 *                                               tiles come from arbitrary hosts;
 *                                               tighten once /api/img proxies them
 *   media-src https:                           — the /jaivik-sathi hero video (CDN)
 *   frame-src youtube                           — the eLibrary handbook video embeds
 */
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data: blob: https:",
  "media-src 'self' blob: https:",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
  "frame-src 'self' https://www.youtube.com https://www.youtube-nocookie.com",
  "worker-src 'self' blob:",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "upgrade-insecure-requests",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(self), geolocation=(self), browsing-topics=()",
  },
];

const nextConfig = {
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
