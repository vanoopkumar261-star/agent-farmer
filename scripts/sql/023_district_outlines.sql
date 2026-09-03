-- 023: District boundary cache for the emergency-alert severity map.
--
-- The alert popup draws the outline of the farmer's own district and glows it
-- by severity. The geometry comes from Nominatim, which will simplify a
-- boundary server-side (`polygon_threshold`) down to a few kilobytes — Dharwad
-- goes from 4212 points / 100 KB raw to 150 points / 4 KB at 0.005, which is
-- still unmistakably Dharwad.
--
-- Cached because a district boundary does not change, and because Nominatim
-- publishes no SLA for this kind of use. One lookup per district, kept forever,
-- shared by every farmer in it — so this is reference data, not farmer-owned,
-- and follows `mandi_geocache` (008) exactly: readable by any signed-in user,
-- written only by the service role.
--
-- `geojson` holds the raw GeoJSON geometry, Polygon or MultiPolygon. Coastal
-- districts (Thiruvananthapuram, for one) return MultiPolygon because of their
-- islands, and storing it unflattened keeps the renderer honest about that.
--
-- The app degrades gracefully until this is applied: without the table the
-- outline lookup returns null and the popup simply shows no map, which is the
-- designed failure path anyway.

begin;

create table if not exists public.district_outlines (
  -- lower("district|state"), e.g. "dharwad|karnataka"
  key        text primary key,
  district   text not null,
  state      text,
  -- GeoJSON geometry: { type: "Polygon" | "MultiPolygon", coordinates: [...] }
  geojson    jsonb not null,
  -- [south, north, west, east] as returned by Nominatim, kept so the projection
  -- does not have to walk every ring to find the extent.
  bbox       jsonb,
  -- Where it came from and how hard it was simplified, so a future change of
  -- threshold can be told apart from the original fetch.
  source     text not null default 'nominatim:0.005',
  created_at timestamptz not null default now()
);

alter table public.district_outlines enable row level security;

grant select on public.district_outlines to authenticated;
grant select, insert, update, delete on public.district_outlines to service_role;

drop policy if exists "district outlines readable" on public.district_outlines;
create policy "district outlines readable" on public.district_outlines
  for select to authenticated
  using (true);

commit;
