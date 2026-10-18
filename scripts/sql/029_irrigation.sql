-- 029: Split the irrigation question, and start recording what was applied.
--
-- Why: `farms.irrigation` was one free-text column holding six values that
-- answered two different questions at once —
--
--     Borewell / Canal / River   → where the water comes from
--     Drip / Sprinkler           → how it is applied
--     Rain-fed                   → neither; there is no irrigation
--
-- so a farmer on a borewell *and* drip had to discard half their own answer.
-- The half most of them dropped is the one that matters for scheduling:
-- application efficiency is a property of the method, and without it there is
-- no way to turn "the crop needs 18 mm" into "run the pump for two hours".
--
-- This splits the question into three columns and leaves the original alone.
--
-- ── Why `farms.irrigation` is kept ──────────────────────────────────────────
-- It is `not null` and is read in a dozen places: the farm chip, the
-- assistant's context block, three LLM prompts, the crop-guide route. Two of
-- those are behavioural — `isRainFed()` in src/lib/agronomy.ts and the water
-- risk factor in src/lib/health.ts both test /rain[\s-]?fed/i against it. The
-- app keeps writing a readable composite there ("Borewell · Drip", or exactly
-- "Rain-fed"), so this migration is additive and nothing downstream breaks on
-- the day it runs.
--
-- ── Until this runs ─────────────────────────────────────────────────────────
-- The app degrades gracefully: resolveIrrigationSetup() falls back to parsing
-- the legacy label, and the irrigation page's event log shows an empty state
-- (src/lib/history.ts swallows the missing-table error, same as 017).

-- ─────────────────────────── 1. the split columns ──────────────────────────

alter table public.farms add column if not exists water_regime text;
alter table public.farms add column if not exists irrigation_source text;
alter table public.farms add column if not exists irrigation_method text;

-- Backfill from whatever the free-text column already holds. Mirrors
-- parseLegacyIrrigation() in src/lib/irrigationCatalog.ts — keep the two in
-- step if either changes.
update public.farms
   set water_regime = case
         when irrigation ~* 'rain[ -]?fed' then 'rainfed'
         else 'irrigated'
       end
 where water_regime is null;

update public.farms
   set irrigation_source = case
         when irrigation ~* 'borewell|bore ?well|tube ?well' then 'borewell'
         when irrigation ~* 'canal' then 'canal'
         when irrigation ~* 'river' then 'river'
         when irrigation ~* 'tank'  then 'tank'
         when irrigation ~* 'pond'  then 'pond'
         when irrigation ~* 'lift'  then 'lift'
         else null
       end
 where irrigation_source is null
   and water_regime = 'irrigated';

update public.farms
   set irrigation_method = case
         when irrigation ~* 'drip' then 'drip'
         when irrigation ~* 'rain ?gun' then 'rain_gun'
         when irrigation ~* 'sprinkler' then 'sprinkler'
         when irrigation ~* 'furrow' then 'furrow'
         when irrigation ~* 'basin' then 'basin'
         when irrigation ~* 'flood' then 'flood'
         when irrigation ~* 'hose' then 'manual_hose'
         else null
       end
 where irrigation_method is null
   and water_regime = 'irrigated';

-- Constraints allow NULL on purpose. A legacy row that said only "Borewell"
-- has no recorded method, and the engine handles that by assuming a
-- conservative efficiency and saying so — which is better than refusing to
-- compute, and far better than inventing a method the farmer never chose.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'farms_water_regime_chk') then
    alter table public.farms
      add constraint farms_water_regime_chk
      check (water_regime is null or water_regime in ('rainfed','irrigated'));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'farms_irrigation_source_chk') then
    alter table public.farms
      add constraint farms_irrigation_source_chk
      check (irrigation_source is null or irrigation_source in
        ('borewell','canal','river','tank','pond','lift','rainwater_harvest'));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'farms_irrigation_method_chk') then
    alter table public.farms
      add constraint farms_irrigation_method_chk
      check (irrigation_method is null or irrigation_method in
        ('drip','sprinkler','rain_gun','furrow','basin','flood','manual_hose'));
  end if;
end $$;

-- ─────────────────────── 2. what was actually applied ──────────────────────
--
-- The problem statement asks for predictions informed by "historical
-- irrigation data", and there was none to inform them with. This is it: the
-- farmer records a watering, and the engine stops guessing where the water
-- balance starts.
--
-- farm_id is nullable and ON DELETE SET NULL for the same reason as
-- soil_readings in 017 — a record of something that was actually done outlives
-- the field it was done on.

create table if not exists public.irrigation_events (
  id uuid primary key default gen_random_uuid(),
  farmer_id uuid not null references public.farmer_profiles(id) on delete cascade,
  farm_id uuid references public.farms(id) on delete set null,
  applied_at timestamptz not null default now(),
  depth_mm numeric check (depth_mm is null or (depth_mm >= 0 and depth_mm <= 500)),
  volume_litres numeric check (volume_litres is null or volume_litres >= 0),
  duration_minutes integer check (duration_minutes is null or (duration_minutes >= 0 and duration_minutes <= 10080)),
  source text not null default 'manual' check (source in ('manual','scheduled','sensor')),
  cost_rupees numeric check (cost_rupees is null or cost_rupees >= 0),
  note text,
  created_at timestamptz not null default now()
);

create index if not exists irrigation_events_farmer_idx
  on public.irrigation_events(farmer_id);
create index if not exists irrigation_events_farm_applied_idx
  on public.irrigation_events(farm_id, applied_at desc);
create index if not exists irrigation_events_applied_idx
  on public.irrigation_events(applied_at desc);

alter table public.irrigation_events enable row level security;

grant select, insert, update, delete
  on public.irrigation_events
  to authenticated, service_role;

-- Owner-scoped, and — because this table carries a `farm_id` — the WITH CHECK
-- also walks farm -> farmer_profiles, per 021.
--
-- Checking only `farmer_id` here would reintroduce exactly what 021 closed: a
-- signed-in farmer could insert a row they legitimately own that points at
-- another tenant's farm, giving an existence oracle for farm UUIDs (a real id
-- succeeds, an invented one raises a FK violation) and a way to hang rows off a
-- stranger's ON DELETE CASCADE graph. USING stays as the farmer_id check alone,
-- matching 021's reasoning that visibility must not retroactively hide rows.
drop policy if exists "own irrigation_events - all" on public.irrigation_events;
create policy "own irrigation_events - all" on public.irrigation_events
  for all to authenticated
  using (
    exists (
      select 1 from public.farmer_profiles p
      where p.id = irrigation_events.farmer_id and p.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.farmer_profiles p
      where p.id = irrigation_events.farmer_id and p.owner_id = auth.uid()
    )
    and (
      irrigation_events.farm_id is null
      or exists (
        select 1 from public.farms f
        join public.farmer_profiles p on p.id = f.farmer_id
        where f.id = irrigation_events.farm_id and p.owner_id = auth.uid()
      )
    )
  );
