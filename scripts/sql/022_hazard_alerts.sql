-- 022: Natural-hazard early warning — event store, push subscriptions, district.
--
-- Until now every alert in the app was derived at render time from a 7-day
-- Open-Meteo forecast (`src/lib/alerts.ts`), which means an alert only exists
-- while the farmer is already looking at the dashboard. That is an explanation,
-- not a warning. This migration backs a pipeline that polls official sources on
-- a schedule and pushes to the farmer's device, so a thunderstorm or flood
-- warning reaches him before the damage rather than after.
--
-- Three pieces, with deliberately different ownership models:
--
--   hazard_events      shared reference data. A warning over Bhopal is the same
--                      warning for every farmer in Bhopal, so it is stored once
--                      and readable by any signed-in user — the same shape as
--                      mandi_geocache (008). Only the service role writes; the
--                      poller runs with the service key.
--
--   push_subscriptions farmer-owned and secret. A Web Push endpoint is a
--                      capability URL: anyone holding it can send that device a
--                      notification, so it is owner-scoped exactly like
--                      notifications (006) and never readable across accounts.
--
--   house_district     denormalised onto farmer_profiles. The CAP feed's
--   house_state        polygon endpoint returns 403, so alerts can only be
--                      matched to a farmer by district *name* parsed from the
--                      warning headline. Nominatim already returns
--                      `state_district` on the reverse-geocode the onboarding
--                      map picker performs — the app simply discarded it.
--
-- Safe to re-run. The app degrades gracefully until this is applied, matching
-- the convention in notifications.ts / notifications-server.ts.

begin;

-- ── Farmer district, for CAP headline matching ───────────────────────────────

alter table public.farmer_profiles
  add column if not exists house_district text;
alter table public.farmer_profiles
  add column if not exists house_state text;

-- Matching normalises both sides, so index the lowered form the query uses.
create index if not exists farmer_profiles_district_idx
  on public.farmer_profiles (lower(house_district));

-- ── Hazard events ────────────────────────────────────────────────────────────

create table if not exists public.hazard_events (
  id           uuid primary key default gen_random_uuid(),
  -- 'cap'     — NDMA SACHET, issued by IMD / CWC / a state SDMA (authoritative)
  -- 'derived' — computed by us from Open-Meteo (an estimate, never a warning)
  -- 'enso'    — NOAA ONI seasonal context
  source       text not null,
  -- The upstream's own id. For CAP this is the <guid>, which is what makes
  -- polling every 10 minutes idempotent: an alert already stored is never
  -- re-fetched and never re-notified.
  source_guid  text not null,
  event        text not null,
  -- CAP severity vocabulary: Extreme | Severe | Moderate | Minor | Unknown.
  severity     text not null default 'Unknown',
  certainty    text,
  urgency      text,
  headline     text not null,
  instruction  text,
  -- Who issued it. Shown in the UI so the app never appears to be the authority.
  sender       text,
  -- Districts parsed from the headline. Array because one warning routinely
  -- covers several ("...over Almora, Pauri Garhwal...").
  districts    text[] not null default '{}',
  state        text,
  onset        timestamptz,
  expires      timestamptz,
  -- The parsed CAP fields as received, so a matching bug can be diagnosed
  -- against what actually arrived rather than what we think arrived.
  raw          jsonb,
  created_at   timestamptz not null default now()
);

create unique index if not exists hazard_events_source_guid_uidx
  on public.hazard_events (source, source_guid);
-- The read path is "what is still live for these districts".
create index if not exists hazard_events_expires_idx on public.hazard_events (expires);
create index if not exists hazard_events_districts_idx on public.hazard_events using gin (districts);

alter table public.hazard_events enable row level security;

grant select on public.hazard_events to authenticated;
grant select, insert, update, delete on public.hazard_events to service_role;

drop policy if exists "hazard events readable" on public.hazard_events;
create policy "hazard events readable" on public.hazard_events
  for select to authenticated
  using (true);

-- ── Push subscriptions ───────────────────────────────────────────────────────

create table if not exists public.push_subscriptions (
  id            uuid primary key default gen_random_uuid(),
  farmer_id     uuid not null references public.farmer_profiles(id) on delete cascade,
  -- The Web Push endpoint URL. Unique: re-subscribing the same browser must
  -- update the existing row, not accumulate duplicates that all fire at once.
  endpoint      text not null,
  p256dh        text not null,
  auth          text not null,
  -- Consecutive send failures. A browser that has revoked permission returns
  -- 404/410 forever; the sender prunes on those rather than retrying nightly.
  failure_count integer not null default 0,
  created_at    timestamptz not null default now(),
  last_seen_at  timestamptz not null default now()
);

create unique index if not exists push_subscriptions_endpoint_uidx
  on public.push_subscriptions (endpoint);
create index if not exists push_subscriptions_farmer_idx
  on public.push_subscriptions (farmer_id);

alter table public.push_subscriptions enable row level security;

grant select, insert, update, delete on public.push_subscriptions to authenticated, service_role;

-- Mirrors the notifications policy in 006: reachable only through a profile the
-- caller owns.
drop policy if exists "own push subscriptions - all" on public.push_subscriptions;
create policy "own push subscriptions - all" on public.push_subscriptions
  for all to authenticated
  using (
    exists (
      select 1 from public.farmer_profiles p
      where p.id = push_subscriptions.farmer_id and p.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.farmer_profiles p
      where p.id = push_subscriptions.farmer_id and p.owner_id = auth.uid()
    )
  );

commit;
