-- 028: Device push tokens, for reaching a handset that is not in the app.
--
-- NOT YET APPLIED, on purpose. Android delivery goes through FCM, and this
-- project has no Firebase credentials — no `google-services.json` in
-- agent-farmer-mobile/android/app/ — so nothing could send to a token stored
-- here. The mobile client (src/lib/push.ts) writes to this table and degrades
-- to a no-op when it is absent, the same convention tasks.ts and
-- notifications.ts already use for a migration that has not landed.
--
-- Apply it once a Firebase project exists. Until then it would be an empty
-- table advertising a capability the build does not have.
--
-- ── Why not reuse push_subscriptions (022) ──────────────────────────────────
-- That table is shaped for the Web Push protocol: an endpoint URL plus the
-- p256dh and auth keys a browser subscription carries. A native FCM token is
-- one opaque string with none of those parts, so storing it there would mean
-- three columns holding placeholder values and a sender unable to tell which
-- transport a row belongs to. Separate tables, one per transport.
--
-- Note that push_subscriptions itself has never had a writer: no service
-- worker and no VAPID keys exist in the web app, so browser push is also
-- unimplemented. Neither table is live.
--
-- Safe to re-run.

begin;

create table if not exists public.push_tokens (
  id           uuid primary key default gen_random_uuid(),
  farmer_id    uuid not null references public.farmer_profiles(id) on delete cascade,
  -- The FCM registration token. Unique: reinstalling or clearing app data
  -- issues a new one, and the same handset re-registering must update its row
  -- rather than accumulate duplicates that all fire at once.
  token        text not null unique,
  platform     text not null default 'android',
  -- A token that FCM rejects as UNREGISTERED should be pruned, not retried
  -- nightly for ever.
  failure_count integer not null default 0,
  created_at   timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create index if not exists push_tokens_farmer_idx on public.push_tokens(farmer_id);

alter table public.push_tokens enable row level security;
alter table public.push_tokens force row level security;

-- A push token is a capability: anyone holding it can send that handset a
-- notification. Owner-scoped exactly like notifications (006) and
-- push_subscriptions (022), and never readable across accounts.
create policy "own push_tokens - all" on public.push_tokens
  for all to authenticated
  using (
    exists (
      select 1 from public.farmer_profiles p
      where p.id = push_tokens.farmer_id and p.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.farmer_profiles p
      where p.id = push_tokens.farmer_id and p.owner_id = auth.uid()
    )
  );

commit;
