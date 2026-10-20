-- TinyFish API key ledger.
--
-- The hackathon grant is five API keys, each with its own quota. `apiKey()` in
-- src/lib/tinyfish.ts read a single environment variable, so four of the five
-- were physically unreachable. This table is what makes a pool possible: it is
-- the shared state that lets concurrent serverless invocations agree on which
-- key to use next and how much each has been asked to do.
--
-- ── Why three counters and not one ───────────────────────────────────────────
--
-- Nobody has told us what a "credit" is. It could be an agent step, a cent, a
-- dollar, or something that free Search and Fetch calls also consume. Rather
-- than guess and build the guess into the schema, this records every unit we
-- can observe:
--
--   agent_steps  — steps reported by completed runs
--   searches     — Search queries issued
--   fetch_urls   — URLs submitted to Fetch (the batch cap is 10, so != calls)
--   spend_usd    — agent_steps x $0.016, the only published rate we have
--
-- After one night of the warm job, comparing these against the TinyFish
-- dashboard tells us the unit by measurement instead of assumption.
--
-- ── Not readable by farmers ──────────────────────────────────────────────────
--
-- Unlike scheme_cache and input_price_cache, there is no `authenticated` select
-- grant here. Spend figures and key health are operator data; a farmer has no
-- reason to see them and a key label is a hint about key material.

begin;

create table if not exists public.tf_key_ledger (
  -- Position in TINYFISH_API_KEYS, so the row survives a key being rotated in
  -- place. The key itself is never stored.
  key_index      int primary key,
  -- 'key0 ****a3f1'. The last four characters only, enough to match a key to
  -- its row in the TinyFish dashboard without writing a usable secret to disk.
  label          text not null,
  agent_steps    bigint not null default 0,
  searches       bigint not null default 0,
  fetch_urls     bigint not null default 0,
  spend_usd      numeric(12,4) not null default 0,
  -- The last thing that went wrong on this key, kept after it is re-enabled so
  -- a key that fails repeatedly is visible rather than silently rotated past.
  last_error     text,
  -- Set when the key reports 402 INSUFFICIENT_CREDITS or 401 INVALID_API_KEY.
  -- Temporary, not permanent: a quota may reset, and a key wrongly retired
  -- would quietly shrink the pool with nothing to show for it.
  disabled_until timestamptz,
  updated_at     timestamptz not null default now()
);

alter table public.tf_key_ledger enable row level security;

grant select, insert, update, delete on public.tf_key_ledger to service_role;

-- Atomic increment. Doing this as read-modify-write in the app would lose
-- counts whenever two serverless invocations charge the same key at once,
-- which is exactly what a pool under load does.
create or replace function public.tf_charge_key(
  p_key_index int,
  p_label     text,
  p_steps     bigint default 0,
  p_searches  bigint default 0,
  p_fetch_urls bigint default 0,
  p_usd       numeric default 0
) returns void
language sql
security definer
set search_path = public
as $$
  insert into public.tf_key_ledger as l
    (key_index, label, agent_steps, searches, fetch_urls, spend_usd, updated_at)
  values
    (p_key_index, p_label, p_steps, p_searches, p_fetch_urls, p_usd, now())
  on conflict (key_index) do update set
    agent_steps = l.agent_steps + excluded.agent_steps,
    searches    = l.searches    + excluded.searches,
    fetch_urls  = l.fetch_urls  + excluded.fetch_urls,
    spend_usd   = l.spend_usd   + excluded.spend_usd,
    label       = excluded.label,
    updated_at  = now();
$$;

revoke all on function public.tf_charge_key(int, text, bigint, bigint, bigint, numeric) from public;
grant execute on function public.tf_charge_key(int, text, bigint, bigint, bigint, numeric) to service_role;

-- ── A run belongs to the key that started it ─────────────────────────────────
--
-- An agent run id is only resolvable by the account that created it, so polling
-- with a different key from the pool returns 404 and the paid run is lost. The
-- key index therefore has to be persisted alongside the run id.
--
-- Existing rows predate the pool and were all started by the single configured
-- key, which becomes index 0, so that is the correct backfill default.
alter table public.input_price_runs
  add column if not exists key_index int not null default 0;

commit;
