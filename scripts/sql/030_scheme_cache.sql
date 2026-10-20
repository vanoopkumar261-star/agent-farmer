-- Live scheme catalogue cache, for /api/schemes.
--
-- Shared reference data, not farmer-owned: the schemes available in Karnataka
-- are the same schemes for every farmer in Karnataka. So this follows
-- 026_store_cache.sql (readable by any authenticated user, written only by the
-- service role) rather than the per-owner RLS of 027_agent_actions.sql.
--
-- Why a cache table at all: filling this costs a TinyFish ladder run, and the
-- top rung is a billable browser agent. Scheme catalogues change on a
-- weeks-to-months timescale, so without a cache the app would spend real money
-- re-learning the same answer on every page load.
--
-- `schemes` holds ONLY the live rows. The eight built-in central schemes live
-- in src/lib/schemes.ts and are merged in at read time. Caching the merged list
-- instead would mean an edit to the built-in catalogue kept serving its old
-- copy until the TTL expired — the staleness trap store_cache solved with its
-- FILTER_VERSION prefix, which the 'v1:' in `key` provides here.

begin;

create table if not exists public.scheme_cache (
  key         text primary key,        -- 'v1:karnataka'
  state       text not null,
  schemes     jsonb not null,          -- Scheme[], live rows only
  provenance  text not null,           -- 'search+fetch' | 'agent' | 'mixed'
  -- The rung-by-rung log of the run that produced this, kept so a cached
  -- answer can still say how it was obtained and what it cost.
  ladder      jsonb not null default '[]'::jsonb,
  cost_usd    numeric(10,4) not null default 0,
  checked_at  timestamptz not null default now(),
  expires_at  timestamptz not null
);

create index if not exists scheme_cache_expires_idx
  on public.scheme_cache (expires_at);

alter table public.scheme_cache enable row level security;

grant select on public.scheme_cache to authenticated;
grant select, insert, update, delete on public.scheme_cache to service_role;

drop policy if exists "scheme cache readable" on public.scheme_cache;
create policy "scheme cache readable"
  on public.scheme_cache
  for select
  to authenticated
  using (true);

commit;
