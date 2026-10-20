-- Live cross-mandi price cache, for /api/live-mandi.
--
-- Shared reference data, same shape and reasoning as 030_scheme_cache.sql and
-- 031_input_price_cache.sql: the tomato rate in Kolar is the same rate for
-- every farmer in Kolar, so any authenticated user may read it and only the
-- service role may write it.
--
-- ── A runs table turned out to be necessary after all ───────────────────────
--
-- This file originally argued the mandi agent could be synchronous, because a
-- probe returned nine mandis in 3 steps and 36 seconds. A later run of the
-- identical job took 57 seconds and was aborted by the route at 55 — billed,
-- completed, and discarded. See 035_mandi_runs.sql for the measurements and
-- the correction. The cache below is unchanged; only the paid rung moved.
--
-- ── TTL ──────────────────────────────────────────────────────────────────────
--
-- Eight hours. Mandi boards move daily and a stale price is one a farmer could
-- drive a loaded trailer to, but within a single trading day the number does
-- not change — so this is short where the scheme cache is long.

begin;

create table if not exists public.mandi_cache (
  key         text primary key,          -- 'v1:tomato:karnataka'
  crop        text not null,
  state       text not null,
  -- The state-level roll-up: median, reporting mandi count, named high and low.
  -- Free Fetch produces this on its own.
  rollup      jsonb,
  -- Individual mandi rows. The client-rendered part, and the only reason the
  -- paid rung exists here.
  mandis      jsonb not null default '[]'::jsonb,
  -- Retail prices per kg. A different data axis from the wholesale rows above,
  -- and the only genuinely new one in this feature. Nullable: most of the crop
  -- catalogue has no retail figure at all (see 036).
  retail      jsonb,
  -- Sources that produced nothing, each with the reason. Stored, not dropped.
  missing     jsonb not null default '[]'::jsonb,
  ladder      jsonb not null default '[]'::jsonb,
  provenance  text not null,             -- 'fetch' | 'agent' | 'datagov' | 'mixed'
  cost_usd    numeric(10,4) not null default 0,
  checked_at  timestamptz not null default now(),
  expires_at  timestamptz not null
);

create index if not exists mandi_cache_expires_idx
  on public.mandi_cache (expires_at);

alter table public.mandi_cache enable row level security;

grant select on public.mandi_cache to authenticated;
grant select, insert, update, delete on public.mandi_cache to service_role;

drop policy if exists "mandi cache readable" on public.mandi_cache;
create policy "mandi cache readable"
  on public.mandi_cache
  for select
  to authenticated
  using (true);

commit;
