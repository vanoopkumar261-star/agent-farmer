-- In-flight mandi agent runs.
--
-- ── Why this exists, written after getting it wrong ──────────────────────────
--
-- 034_mandi_cache.sql claimed no runs table was needed because the mandi agent
-- was synchronous and fast: a probe had returned all nine Kolar mandis in
-- 3 steps and 36 seconds, comfortably inside the 60-second function ceiling.
--
-- That was one sample. In the first end-to-end test the same 3-step job took
-- 57 seconds (run 9f4b5ba8-bf83-4ae3-a4a2-a4fb5a86dd77, 08:50:35 -> 08:51:32).
-- The route's AbortSignal fired at 55 s, so the app recorded "timeout, $0.000"
-- and discarded a run that had COMPLETED with all 14 rows. We paid $0.048 for
-- an answer we threw away — the precise failure the async shape exists to
-- prevent, and the reason input_price_runs exists in 031.
--
-- Observed durations for identical work: 36 s, 45 s, 57 s. Queue time alone
-- ranged from 2 s to 23 s. No synchronous timeout is safe under a 60-second
-- ceiling, so the run now outlives the request that started it.
--
-- ── Owner RLS, not shared-read ───────────────────────────────────────────────
--
-- A run id is a bearer token for work somebody paid for. Anyone who could
-- guess or replay one could collect a browser run they did not fund, so unlike
-- mandi_cache this is force-RLS and scoped to the owner.

begin;

create table if not exists public.mandi_runs (
  run_id      text primary key,          -- TinyFish run id
  owner_id    uuid not null references auth.users (id) on delete cascade,
  -- The pool position that started the run. TinyFish resolves a run id only
  -- for the account that created it, so collecting with a sibling key 404s.
  key_index   int  not null default 0,
  cache_key   text not null,
  crop        text not null,
  state       text not null,
  -- The free rung's results, held so the agent's named rows can be merged with
  -- them rather than replacing them. A failed run must still leave the roll-up
  -- and the retail comparison on screen.
  rollup      jsonb,
  retail      jsonb,
  missing     jsonb not null default '[]'::jsonb,
  ladder      jsonb not null default '[]'::jsonb,
  -- The free tier's markdown for the same URL, kept as the corroboration
  -- source: an agent row whose modal price is absent from this text is
  -- dropped. Without it the validator would have nothing to check against by
  -- the time the run finishes.
  source_text text not null default '',
  created_at  timestamptz not null default now()
);

create index if not exists mandi_runs_owner_idx on public.mandi_runs (owner_id);
create index if not exists mandi_runs_created_idx on public.mandi_runs (created_at);

alter table public.mandi_runs enable row level security;
alter table public.mandi_runs force row level security;

grant select on public.mandi_runs to authenticated;
grant select, insert, update, delete on public.mandi_runs to service_role;

drop policy if exists "own mandi runs" on public.mandi_runs;
create policy "own mandi runs"
  on public.mandi_runs
  for select
  to authenticated
  using (owner_id = auth.uid());

commit;
