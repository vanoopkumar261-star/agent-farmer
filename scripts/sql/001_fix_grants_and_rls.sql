-- Fix: tables had RLS enabled with zero policies, and were missing
-- SELECT/INSERT/UPDATE/DELETE grants for anon/authenticated/service_role.
-- Result: every insert from the app silently failed with "permission denied".
--
-- No Supabase Auth is wired up yet, so there's no user identity to scope
-- rows to. These policies are intentionally permissive (anon + authenticated
-- can do anything) to unblock the MVP. Once auth ships, tighten these to
-- check auth.uid() against a farmer_id/owner column.

grant select, insert, update, delete
  on public.farmer_profiles, public.farms, public.crop_cycles, public.farm_expenses
  to anon, authenticated, service_role;

drop policy if exists "allow all - farmer_profiles" on public.farmer_profiles;
create policy "allow all - farmer_profiles" on public.farmer_profiles
  for all to anon, authenticated using (true) with check (true);

drop policy if exists "allow all - farms" on public.farms;
create policy "allow all - farms" on public.farms
  for all to anon, authenticated using (true) with check (true);

drop policy if exists "allow all - crop_cycles" on public.crop_cycles;
create policy "allow all - crop_cycles" on public.crop_cycles
  for all to anon, authenticated using (true) with check (true);

drop policy if exists "allow all - farm_expenses" on public.farm_expenses;
create policy "allow all - farm_expenses" on public.farm_expenses
  for all to anon, authenticated using (true) with check (true);
