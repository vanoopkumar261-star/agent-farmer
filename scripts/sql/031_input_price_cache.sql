-- Farm-input price comparison cache, for /api/input-prices.
--
-- Shared reference data, same shape and same reasoning as 030_scheme_cache.sql:
-- the price of urea on AgriBegri is the same price for every farmer, so this is
-- readable by any authenticated user and written only by the service role.
--
-- `runs` is the part that is specific to this feature. Agent runs here take
-- 70-166 seconds, which is past the serverless function ceiling, so the route
-- starts a run and returns its id rather than waiting. The client then polls.
-- That means a run has to be owned by someone across requests: without this
-- table, anyone who guessed a run id could collect — and pay nothing for — a
-- browser run that someone else started.

begin;

create table if not exists public.input_price_cache (
  key         text primary key,          -- 'v1:fertiliser:urea'
  category    text not null,
  term        text not null,
  rows        jsonb not null,
  -- Sites that produced nothing, each with the reason. Stored, not discarded:
  -- "IFFCO Bazar could not be read" is a fact the farmer is owed.
  missing     jsonb not null default '[]'::jsonb,
  ladder      jsonb not null default '[]'::jsonb,
  provenance  text not null,
  cost_usd    numeric(10,4) not null default 0,
  checked_at  timestamptz not null default now(),
  expires_at  timestamptz not null
);

create index if not exists input_price_cache_expires_idx
  on public.input_price_cache (expires_at);

alter table public.input_price_cache enable row level security;

grant select on public.input_price_cache to authenticated;
grant select, insert, update, delete on public.input_price_cache to service_role;

drop policy if exists "input price cache readable" on public.input_price_cache;
create policy "input price cache readable"
  on public.input_price_cache
  for select
  to authenticated
  using (true);

-- In-flight agent runs, so a poll can prove the caller started the run.
create table if not exists public.input_price_runs (
  run_id      text primary key,          -- TinyFish run id
  owner_id    uuid not null references auth.users (id) on delete cascade,
  cache_key   text not null,
  category    text not null,
  term        text not null,
  site_id     text not null,
  -- The free rungs' results, held so the agent's rows can be merged with them
  -- when the run finishes rather than replacing them.
  partial     jsonb not null default '[]'::jsonb,
  missing     jsonb not null default '[]'::jsonb,
  ladder      jsonb not null default '[]'::jsonb,
  created_at  timestamptz not null default now()
);

create index if not exists input_price_runs_owner_idx
  on public.input_price_runs (owner_id);

alter table public.input_price_runs enable row level security;
alter table public.input_price_runs force row level security;

grant select on public.input_price_runs to authenticated;
grant select, insert, update, delete on public.input_price_runs to service_role;

drop policy if exists "own input price runs" on public.input_price_runs;
create policy "own input price runs"
  on public.input_price_runs
  for select
  to authenticated
  using (owner_id = auth.uid());

commit;
