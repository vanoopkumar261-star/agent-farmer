-- 017: Manual soil-pH readings.
--
-- The dashboard's live sensor panel needs continuous Wi-Fi at the farm, which
-- most fields don't have. Soil pH is measured with a cheap handheld meter
-- instead — the farmer photographs its display, AI reads the number, and it is
-- stored here. Owner-scoped RLS mirrors 004/005.
--
-- farm_id is nullable and ON DELETE SET NULL: a reading is a record of
-- something that was actually measured, so it outlives a deleted farm (same
-- choice as crop_health_records in 005).
--
-- Until this migration runs the app degrades gracefully — the pH card and page
-- show an empty state and nothing breaks (src/lib/history.ts swallows the
-- missing-table error).

create table if not exists public.soil_readings (
  id uuid primary key default gen_random_uuid(),
  farmer_id uuid not null references public.farmer_profiles(id) on delete cascade,
  farm_id uuid references public.farms(id) on delete set null,
  ph numeric(4,2) not null check (ph >= 0 and ph <= 14),
  source text not null default 'photo' check (source in ('photo', 'manual')),
  ai_confidence numeric,            -- 0..1 for a photo read; null for manual entry
  note text,
  created_at timestamptz not null default now()
);

create index if not exists soil_readings_farmer_idx on public.soil_readings(farmer_id);
create index if not exists soil_readings_created_idx on public.soil_readings(created_at desc);

alter table public.soil_readings enable row level security;

grant select, insert, update, delete
  on public.soil_readings
  to authenticated, service_role;

create policy "own soil_readings - all" on public.soil_readings
  for all to authenticated
  using (
    exists (
      select 1 from public.farmer_profiles p
      where p.id = soil_readings.farmer_id and p.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.farmer_profiles p
      where p.id = soil_readings.farmer_id and p.owner_id = auth.uid()
    )
  );
