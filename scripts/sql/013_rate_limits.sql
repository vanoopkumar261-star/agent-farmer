-- 013: Per-caller rate limiting for the AI endpoints.
--
-- Five AI routes take no authentication at all — recommendations, crop-guide,
-- market-advice, scheme-match, and chat (which looks a user up but does not
-- require one). Every call spends Groq tokens, so anyone with the URL could
-- drain the project's quota from a shell loop.
--
-- The counter lives in Postgres rather than in process memory because the app
-- runs as serverless functions: each instance has its own memory, so an
-- in-memory counter limits nothing once traffic spreads across instances.
-- Postgres is the only state all instances already share, and it keeps the
-- project's zero-cost stack intact (no Redis, no new signup).
--
-- Rows are keyed by (caller, endpoint, window) so a burst simply increments one
-- row. Old windows are dead weight and are swept on write; see cleanupExpired
-- in src/lib/rateLimit.ts.

create table if not exists public.api_rate_limits (
  -- "<endpoint>:<farmer-id or ip>" — built by the caller, never by the client.
  bucket_key   text        not null,
  -- Start of the fixed window this count belongs to.
  window_start timestamptz not null,
  hits         integer     not null default 0,
  primary key (bucket_key, window_start)
);

-- Sweeping deletes by age, so the index is on the window, not the key.
create index if not exists api_rate_limits_window_idx
  on public.api_rate_limits (window_start);

alter table public.api_rate_limits enable row level security;

-- No policies, and no grants to anon or authenticated: RLS denies by default and
-- the route handlers write with the service role. A client that could read this
-- table would learn nothing useful; one that could write it could clear its own
-- counter, which is the whole thing this table exists to prevent.
revoke all on public.api_rate_limits from anon, authenticated;
grant select, insert, update, delete on public.api_rate_limits to service_role;

comment on table public.api_rate_limits is
  'Fixed-window request counters for the AI endpoints. Service-role only; written by src/lib/rateLimit.ts.';

-- Counting has to be atomic, and a plain upsert cannot do it: `upsert({hits: 1})`
-- *overwrites* the count, so two concurrent requests both end up at 1 and the
-- limit never trips. A read-then-write from the app has the same race with a
-- wider window. This does the increment inside one statement, where Postgres
-- serialises conflicting writers on the primary key, and returns the resulting
-- count so the caller learns its position in the window from the same round trip.
create or replace function public.bump_rate_limit(
  p_key    text,
  p_window timestamptz,
  p_limit  integer
)
returns integer
language plpgsql
as $$
declare
  new_hits integer;
begin
  insert into public.api_rate_limits as t (bucket_key, window_start, hits)
  values (p_key, p_window, 1)
  on conflict (bucket_key, window_start)
    do update set hits = t.hits + 1
  returning t.hits into new_hits;

  return new_hits;
end;
$$;

-- Only the service role may count requests. If the browser could call this it
-- could burn its own budget to zero, or reset it — either way the limiter would
-- be advisory rather than enforced.
revoke all on function public.bump_rate_limit(text, timestamptz, integer) from public, anon, authenticated;
grant execute on function public.bump_rate_limit(text, timestamptz, integer) to service_role;
