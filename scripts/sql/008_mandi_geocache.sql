-- 008: Mandi geocode cache (Market page price breakdown).
--
-- The Agmarknet feed carries no coordinates, so mandi locations are resolved via
-- Nominatim. This table caches those lookups permanently: it is shared reference
-- data (a mandi's location is the same for every farmer), NOT farmer-owned, so
-- it is readable by any signed-in user and written only by the service role.
--
-- 'source' records how good the fix is: 'geocoded' = the market itself resolved,
-- 'district' = only the district centre resolved (±20-30 km), 'none' = nothing
-- resolved (cached as a negative result so we stop re-querying it).
-- The app degrades gracefully until this migration is applied.

create table if not exists public.mandi_geocache (
  key text primary key,                    -- lower("market|district|state")
  lat double precision,
  lng double precision,
  source text not null default 'none',     -- 'geocoded' | 'district' | 'none'
  created_at timestamptz not null default now()
);

alter table public.mandi_geocache enable row level security;

grant select on public.mandi_geocache to authenticated;
grant select, insert, update on public.mandi_geocache to service_role;

drop policy if exists "geocache readable" on public.mandi_geocache;
create policy "geocache readable" on public.mandi_geocache
  for select to authenticated
  using (true);
