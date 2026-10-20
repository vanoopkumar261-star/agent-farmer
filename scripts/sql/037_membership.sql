-- Membership tiers: Krishi Mitra (free), Krishi Pro, Krishi Elite.
--
-- The app had no concept of a paying customer, so every feature was open to
-- every signed-in farmer. This adds the tier, and the monthly counters that
-- make the free tier's allowances real rather than decorative.
--
-- ── Why the tier is a column and not preferences jsonb ───────────────────────
--
-- `farmer_profiles.preferences` already carries small, rarely-read answers
-- (oilseed_ack, pincode). The plan is read on nearly every authenticated
-- request to decide whether to do the work at all, and it is constrained to
-- three values. A column gets a check constraint and an index if it ever needs
-- one; a jsonb key gets neither.

begin;

alter table public.farmer_profiles
  add column if not exists plan text not null default 'free',
  -- 'monthly' | 'annual'. Null on free, which has no cycle to speak of.
  add column if not exists plan_cycle text,
  add column if not exists plan_selected_at timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'farmer_profiles_plan_check'
  ) then
    alter table public.farmer_profiles
      add constraint farmer_profiles_plan_check check (plan in ('free','pro','elite'));
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'farmer_profiles_plan_cycle_check'
  ) then
    alter table public.farmer_profiles
      add constraint farmer_profiles_plan_cycle_check
        check (plan_cycle is null or plan_cycle in ('monthly','annual'));
  end if;
end $$;

-- ── Nobody loses what they already had ───────────────────────────────────────
--
-- Every account that exists at this moment signed up when all of these features
-- were open. Defaulting them to 'free' would retroactively cap a farmer who has
-- been using unlimited scans since August, which is not a product decision —
-- it is a regression delivered by a migration.
--
-- The column default stays 'free', so accounts created from here on start
-- there and choose during onboarding. This statement is a one-time fact about
-- people who predate tiers, and it is guarded so re-running the migration
-- cannot sweep up genuinely-free accounts created afterwards.
update public.farmer_profiles
   set plan = 'pro',
       plan_cycle = 'annual',
       plan_selected_at = now()
 where plan = 'free'
   and plan_selected_at is null;

-- ── Monthly entitlement counters ─────────────────────────────────────────────
--
-- Deliberately not api_rate_limits. That table is service-role-only with no
-- select grant to authenticated, so the UI could never render "2 of 3 scans
-- left"; its windows are swept hourly; and an abuse limit and an entitlement
-- allowance answer different questions. A 429 means "slow down", a 402 means
-- "this is not included in your plan" — sharing a table would blur them.
create table if not exists public.feature_usage (
  owner_id   uuid not null references auth.users (id) on delete cascade,
  -- 'disease_scan' | 'assistant_query' | 'live_lookup'
  feature    text not null,
  -- Calendar month in IST, 'YYYY-MM'. Computed in one helper in the app so
  -- every route agrees on when a month turns over.
  period     text not null,
  used       integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (owner_id, feature, period)
);

alter table public.feature_usage enable row level security;
alter table public.feature_usage force row level security;

-- Readable by its owner, because the meter in the UI is the honest half of a
-- quota: a farmer who is about to be refused should be able to see it coming.
grant select on public.feature_usage to authenticated;
grant select, insert, update, delete on public.feature_usage to service_role;

drop policy if exists "own feature usage" on public.feature_usage;
create policy "own feature usage"
  on public.feature_usage
  for select
  to authenticated
  using (owner_id = auth.uid());

-- Same reasoning as bump_rate_limit in 013: a read-then-write loses increments
-- when two requests land together, and `upsert({used: 1})` overwrites rather
-- than adds. Done in one statement, Postgres serialises conflicting writers on
-- the primary key and hands back the resulting count.
create or replace function public.bump_feature_usage(
  p_owner   uuid,
  p_feature text,
  p_period  text
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  new_used integer;
begin
  insert into public.feature_usage as u (owner_id, feature, period, used, updated_at)
  values (p_owner, p_feature, p_period, 1, now())
  on conflict (owner_id, feature, period)
    do update set used = u.used + 1, updated_at = now()
  returning u.used into new_used;

  return new_used;
end;
$$;

-- Only the service role may count. A browser that could call this could spend
-- its own allowance to zero, or decline to spend it at all — either way the
-- quota would be advisory.
revoke all on function public.bump_feature_usage(uuid, text, text) from public, anon, authenticated;
grant execute on function public.bump_feature_usage(uuid, text, text) to service_role;

comment on table public.feature_usage is
  'Per-farmer monthly entitlement counters. Owner-readable for the UI meter; written only by src/lib/entitlements.ts via bump_feature_usage.';

commit;
