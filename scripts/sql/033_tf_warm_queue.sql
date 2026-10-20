-- Work queue for the nightly TinyFish cache warmer.
--
-- ── Why a queue and not a loop ───────────────────────────────────────────────
--
-- Warming every state's scheme desk, the common input terms and the main
-- crop/state mandi boards is minutes of work, against a 60-second serverless
-- function. So the route drains a queue for ~45 seconds and returns how much
-- is left, and the GitHub Actions workflow calls it again until nothing is.
-- Progress survives between invocations because it is here, in a row, rather
-- than in a variable belonging to a function that has already been killed.
--
-- ── Why GitHub Actions at all ────────────────────────────────────────────────
--
-- Vercel Cron on the Hobby plan runs at most once a day and cannot be asked to
-- call the same endpoint twenty times in a row. The hazard poller
-- (.github/workflows/hazard-poll.yml) already solved this; this reuses the
-- arrangement and the shared CRON_SECRET check in src/lib/cronAuth.ts.
--
-- ── Why warming is free ──────────────────────────────────────────────────────
--
-- The warmer runs the FREE rungs only: Search and Fetch. It never starts a
-- browser run. Two reasons. A cron has no signed-in user, and an agent run is
-- owned by one — mandi_runs.owner_id references auth.users precisely so a run
-- cannot be collected by whoever guesses its id. And the free rungs are where
-- the breadth is: a state's scheme desk is entirely free, and a mandi roll-up
-- with the named high and low costs nothing. Paying for the last mile on 36
-- states nightly would spend real money on pages nobody has opened.
--
-- A farmer pressing "check again" still escalates to the browser, because
-- startLiveMandi ignores a cached answer that has no mandi names.

begin;

create table if not exists public.tf_warm_queue (
  id          bigserial primary key,
  kind        text not null,                     -- 'scheme' | 'input' | 'mandi'
  target      text not null,                     -- 'Karnataka' | 'fertiliser:urea' | 'Tomato:Karnataka'
  status      text not null default 'pending',   -- pending | done | failed
  attempts    int  not null default 0,
  last_error  text,
  cost_usd    numeric(10,4) not null default 0,
  ran_at      timestamptz,
  -- One row per thing to warm. The unique key is what makes re-seeding
  -- idempotent: a nightly reset flips statuses rather than inserting duplicates.
  unique (kind, target)
);

create index if not exists tf_warm_queue_status_idx on public.tf_warm_queue (status, id);

alter table public.tf_warm_queue enable row level security;

-- Operator data, like tf_key_ledger: no `authenticated` grant.
grant select, insert, update, delete on public.tf_warm_queue to service_role;

-- The table grant alone is not enough for a bigserial key: inserting calls
-- nextval() on the sequence, which is a separately owned object. Every other
-- cache table in this schema uses a text primary key, so this is the first
-- place it comes up — and it fails as "permission denied for sequence", which
-- surfaces as a seeding error rather than anything about grants.
grant usage, select on sequence public.tf_warm_queue_id_seq to service_role;

commit;
