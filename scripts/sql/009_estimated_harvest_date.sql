-- 009: Per-farm estimated harvest date + oilseed awareness acknowledgement.
--
-- Both additions are backward compatible:
--   * crop_cycles.estimated_harvest_date is nullable — existing cycles keep
--     working and the app falls back to the agronomy engine's crop-cycle
--     estimate whenever the column is null.
--   * The oilseed acknowledgement rides in the existing
--     farmer_profiles.preferences jsonb, so no new column is needed there.

alter table public.crop_cycles
  add column if not exists estimated_harvest_date date;

comment on column public.crop_cycles.estimated_harvest_date is
  'Farmer-confirmed harvest date for this cycle. Seeded from the agronomy engine
   (crop cycle length + seeding date) during onboarding, but editable — a value
   here always wins over the computed estimate.';
