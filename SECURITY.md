# Security posture

This documents what protects Agent Farmer beyond Postgres row-level security, and
the manual (dashboard / platform) steps that back the in-repo configuration.

## In place

### Data isolation
- **RLS on every owner table** — `farmer_profiles`, `farms`, `crop_cycles`,
  `farm_expenses`, `farm_tasks`, `health_snapshots`, `crop_health_records`,
  `chat_messages`, `notifications`, `soil_readings`, and `storage.objects` for
  the `leaf-scans` bucket. Each policy resolves to `owner_id = auth.uid()`
  (directly or through an `EXISTS` walk). `feedback`, `api_rate_limits`,
  `security_audit` and `schema_migrations` are RLS-enabled with **no policy** —
  reachable only via the service role.
- **Write-time reference checks** (`021_child_ownership_checks.sql`) — the child
  tables validate the `farm_id` / `crop_id` a row points at, not just its
  `farmer_id`, so a row cannot be attached to another tenant's farm.
- `scripts/sql/015_reapply_owner_rls.sql` re-applies the owner-scoped policies
  that `007` had temporarily reverted, and `019_baseline_owner_tables.sql`
  supplies the `enable row level security` statements for the four
  dashboard-created tables, which no migration previously contained — so
  replaying the history now produces a secured database rather than one whose
  policies are present but never consulted. RLS is additionally `FORCE`d on those
  four. Verified against the live project: the anon key gets `42501` on every
  owner table, and holds no table privileges on them at all
  (`020_grant_hygiene.sql` — the earlier revokes named only the four DML
  privileges, leaving `TRUNCATE`, which bypasses RLS entirely).

### Known-fixed
- **2026-09-01 — cross-tenant read of every leaf scan (`018`).** `014` intended to
  make the `leaf-scans` bucket private and failed for two reasons: it never
  dropped the permissive `"leaf-scans public read"` / `"leaf-scans authenticated
  insert"` policies created in `005`, and its replacements referenced an
  unqualified `name` inside `exists (select 1 from farmer_profiles p ...)`, which
  Postgres bound to `farmer_profiles.name` rather than `storage.objects.name` —
  making all three owner policies permanently false. Anyone holding the anon key
  (shipped in the web bundle and the mobile app) could list every farmer's folder
  and download their field photographs; any signed-in user could write into any
  farmer's prefix. Fixed in `018_fix_leaf_scans_exposure.sql` and verified both
  ways: anon now lists `[]` and gets 404 on a known object, while a signed-in
  farmer can still read, write and list their own prefix — which the owner-scoped
  policies had in fact never permitted before.
- **Access audit** (`016_access_audit.sql`) — an `AFTER` trigger on
  `farmer_profiles` writes every INSERT/UPDATE/DELETE (actor `auth.uid()`,
  changed columns, timestamp) to an append-only `security_audit` table that no
  API role can read.
- `bump_rate_limit` runs `SECURITY INVOKER` with a pinned `search_path`.

### Transport / browser
- `next.config.mjs` sets, on every response: **CSP** (`script-src 'self'
  'unsafe-inline'`; `frame-ancestors 'none'`; `object-src 'none'`; Google Fonts
  and `*.supabase.co` allow-listed; YouTube allow-listed for `frame-src`),
  **HSTS** (2 years, preload), `X-Frame-Options: DENY`, `X-Content-Type-Options:
  nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`,
  `Permissions-Policy` (camera off, mic/geo self only). `X-Powered-By` disabled.
- **No XSS sinks** — no `dangerouslySetInnerHTML`, `eval`, or markdown-to-HTML
  anywhere. All user and LLM text renders as React children (auto-escaped).
- **Image proxy** (`/api/img`) — third-party article images are fetched
  server-side (https-only, 5 MB cap, `image/*` check) so the browser never
  contacts arbitrary hosts and the CSP stays tight. Article links are
  scheme-validated before they reach an `href`.
  The route is also an SSRF surface in its own right, and until 2026-09-04 it
  did not defend itself: the URL is caller-supplied and only its *scheme* was
  checked, so an anonymous request could reach `169.254.169.254` or any
  internal address. Every hop is now DNS-resolved and rejected if it lands in
  private, loopback, link-local, CGNAT or reserved space, and redirects are
  followed manually (max 3) so the destination is validated too rather than
  trusted because the first host looked reasonable. Residual: the resolve and
  the fetch are separate lookups, so DNS rebinding is not covered.

### Data minimisation
- **The assistant prompt carries no direct identifiers.** It previously sent the
  farmer's name, **phone number** and full postal address to Groq on every chat
  turn. The phone was never used; the address is now coarsened to district and
  state, which is all regional advice needs — the weather is already resolved
  server-side from the coordinates. Data that is not sent cannot leak.
- **Assistant questions are not logged.** The RAG retriever logged every query
  verbatim on both the hit and miss branches, putting the most sensitive text in
  the app into the platform log drain with no retention policy. Only the
  numeric retrieval diagnostics are logged now.

### API routes
- **Fixed-window rate limiting** (`src/lib/rateLimit.ts`, Postgres-backed) on
  every LLM/data/upload route including `/api/news` and `/api/img`. Caller keyed
  server-side (session id, else IP) — never from the body.
- **Bounded, clamped input** (`src/lib/apiInput.ts`) — `/api/chat`,
  `/api/market-advice`, `/api/scheme-match`, `/api/recommendations`, `/api/news`,
  `/api/feedback` reject an over-size body before parsing and clamp every string
  / array field that reaches a Groq prompt.
- **CSRF backstop** — `/api/feedback` (the only unauthenticated writer) checks
  the request `Origin`/`Referer` against its host.
- **Uploads** (`/api/disease`) — size checked before buffering, container
  identified by magic bytes (declared MIME ignored), then re-encoded through
  `sharp`: strips all metadata (EXIF/GPS), applies orientation, caps dimensions
  to 2048 px, and refuses > 25 MP (decompression-bomb guard). `/api/transcribe`
  sniffs the audio container.
- **Secrets** — `SUPABASE_SERVICE_ROLE_KEY` and every API key are server-only and
  absent from any `"use client"` module. `DATA_GOV_API_KEY` is read only inside
  `src/lib/market-server.ts` (`import "server-only"`).
- Auth intent is version-controlled in `supabase/config.toml`.

## Manual steps (apply in the Supabase / Vercel dashboards)

`supabase/config.toml` records the target; the hosted project is dashboard-managed
so these must also be set there:

- [ ] **Auth → Providers → Email:** turn ON "Confirm email" and configure SMTP.
      This also enables password reset, which does not currently exist.
      **Blocked on SMTP, and the order matters:** `RESEND_API_KEY` is not set in
      any environment, so switching confirmation on today would fall back to
      Supabase's built-in mailer (a few messages an hour, not for production)
      and effectively break signup. Verified 2026-09-04 that confirmation is
      still off: all 35 accounts were confirmed a mean of 0.05 s after signup,
      which is auto-confirm, not delivery.
      The client-side half is done — the signup form now enforces the 8
      characters `[auth.password] min_length` already requires, in all nine
      languages, instead of the 6 it had been asking for.
- [ ] **Auth → Policies:** enable "Prevent use of leaked passwords" (HIBP);
      set minimum password length to 8 and require mixed character classes.
- [ ] **Auth → Sessions:** confirm refresh-token rotation + reuse detection are ON.
- [ ] **Auth → Bot & Abuse Protection:** enable CAPTCHA (Cloudflare Turnstile),
      set `TURNSTILE_SECRET_KEY` / `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, and add the
      widget to the login and feedback forms.
- [ ] **Database → Backups:** enable Point-in-Time Recovery.
- [ ] **Vercel → Firewall:** enable the WAF / Attack Challenge Mode.
- [ ] **Vercel → Deployment Protection:** require auth for preview deployments.
- [ ] Set `NEXT_PUBLIC_SITE_URL` and the Supabase `site_url` to the production
      domain.
- [ ] Rotate `SUPABASE_SERVICE_ROLE_KEY` and the personal access token in
      `.env.admin.local` if either has ever been shared.

## Known trade-offs

- **Signup enumeration:** the onboarding "this email is already registered"
  modal is a deliberate UX choice for a low-sensitivity consumer app. Supabase
  rate-limits the endpoint; enabling Turnstile makes automated enumeration
  expensive. Making the response uniform is only coherent once email
  confirmation is ON.
- **Rate limiter fails open** on a Postgres/env outage — an in-process fallback
  bucket is a planned follow-up.
- **CSP `script-src` keeps `'unsafe-inline'`** — Next's App Router injects inline
  bootstrap and this build has no nonce plumbing yet. External script origins
  are still blocked. Nonce-based CSP is a planned follow-up.
- **`next@14.2.35`** closes CVE-2025-29927 (the middleware auth-bypass that is
  load-bearing here). `npm audit` still flags Next-bundled issues — including
  `postcss` — whose only fix is Next 16, a major migration. Several of those
  advisories are genuinely inapplicable (they need a custom server or
  attacker-controlled rewrites, neither of which exists here), but **not all of
  them are**: the Server Components DoS advisories apply to any App Router
  build, so this is a deferred risk rather than an excluded one.
- **`sharp@0.35.4`** (was `0.33.5`). This one was previously mischaracterised
  here as Next-bundled and therefore unfixable. It is a direct dependency, it
  was independently fixable, and it decodes attacker-supplied image bytes on
  `/api/disease` and `/api/soil-reading` — the most reachable vulnerability in
  the tree. Upgraded 2026-09-04 and the pipeline re-verified: EXIF/GPS still
  stripped, output still capped at 2048 px, >25 MP still refused.
