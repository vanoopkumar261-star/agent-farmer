-- 011: Feedback submissions from the public landing page.
--
-- The form sits on "/" and is open to visitors who have no account, so this
-- table cannot be scoped through farmer_profiles the way 003 scopes everything
-- else. It is write-only from the outside instead: nobody may read it through
-- the API at all, and the app's own route handler writes with the service-role
-- key, which bypasses RLS.
--
-- That asymmetry is the point. Feedback rows contain a stranger's email address
-- and free text; a policy that let the anon key read them back would publish
-- every submission to anyone holding a key that ships in the browser bundle.

create table if not exists public.feedback (
  id           uuid primary key default gen_random_uuid(),
  email        text not null,
  message      text not null,
  -- Set when a signed-in farmer submits; null for anonymous visitors. No FK to
  -- auth.users on purpose — deleting an account should not delete the feedback
  -- they left, and ON DELETE SET NULL would need a nullable FK anyway.
  owner_id     uuid,
  -- Which page/section it came from, so a second form later stays separable.
  source       text not null default 'landing',
  -- Coarse request context for spam triage. Deliberately NOT an IP address:
  -- storing one turns this into personal data with retention obligations, and
  -- it buys nothing that the honeypot does not already handle.
  user_agent   text,
  -- Flipped by the notifier once the alert email is accepted by the provider,
  -- so a provider outage is visible in the data instead of silently lost.
  notified_at  timestamptz,
  created_at   timestamptz not null default now()
);

create index if not exists feedback_created_idx on public.feedback (created_at desc);

alter table public.feedback enable row level security;

-- No policies are created, and RLS denies by default. Combined with the revoke
-- below, both anon and authenticated are shut out entirely; only the
-- service-role key (which bypasses RLS) can touch this table.
revoke all on public.feedback from anon, authenticated;

-- service_role bypasses RLS but is still subject to ordinary table privileges,
-- and a table created through the management API does not pick up Supabase's
-- default grants. Without this the route handler fails with 42501
-- "permission denied for table feedback" even though it holds the right key.
grant select, insert, update on public.feedback to service_role;

comment on table public.feedback is
  'Landing-page feedback. Service-role only: written by /api/feedback, never readable via the anon or authenticated keys.';
