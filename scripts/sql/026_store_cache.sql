-- 026: Cache for nearby agri-supply shops.
--
-- The store locator previously showed six invented shops placed on a circle
-- around the farmer's house, which is why tapping Directions navigated into an
-- empty field. Real results now come from Google Places, and Places is billed:
-- Text Search sits in the Pro tier at 5,000 free calls a month, then $32 per
-- thousand. Without a cache every page load spends one.
--
-- A shop's location does not change, so results are kept indefinitely and
-- shared. The key rounds the farmer's coordinates to one decimal place — about
-- 11 km — so everyone in a locality reuses one lookup. That is a safe amount of
-- smearing when the search radius is 100 km: shifting the centre 11 km barely
-- changes which shops fall inside the circle, and each row's distance is
-- recomputed per farmer from their own coordinates anyway.
--
-- Shared reference data, not farmer-owned, so it follows mandi_geocache (008)
-- and district_outlines (023): readable by any signed-in user, written only by
-- the service role. Degrades to a no-op before this migration is applied.

begin;

create table if not exists public.store_cache (
  -- "lat,lng" rounded to 1dp, e.g. "15.4,75.1"
  key         text primary key,
  -- Which tier produced this: 'places' or 'osm'. Kept so a cache filled during
  -- an outage — when the chain fell back to OSM — can be told apart from a
  -- proper Places result and refreshed later.
  source      text not null,
  -- The shop list as stored: [{ id, name, type, lat, lng, address }]
  -- No rating. The old one was a hash of the shop's name presented as a review
  -- score, and asking Places for a real one re-prices every call from Pro to
  -- Enterprise, cutting the free allowance from 5,000 a month to 1,000.
  stores      jsonb not null,
  radius_km   int not null default 100,
  created_at  timestamptz not null default now()
);

create index if not exists store_cache_created_idx on public.store_cache (created_at);

alter table public.store_cache enable row level security;

grant select on public.store_cache to authenticated;
grant select, insert, update, delete on public.store_cache to service_role;

drop policy if exists "store cache readable" on public.store_cache;
create policy "store cache readable" on public.store_cache
  for select to authenticated
  using (true);

commit;
