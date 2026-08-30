-- 015: Re-apply per-farmer owner-scoped RLS — undo the temporary 007 revert.
--
-- 007_revert_to_permissive.sql put farmer_profiles / farms / crop_cycles /
-- farm_expenses back to "allow all using(true)" for anon + authenticated so the
-- old no-auth Vercel build kept working. The auth-enabled build has been live
-- since 2026-08-15 and 003 was re-applied against the database by hand that day
-- — but never captured as a migration, so replaying scripts/sql/*.sql in order
-- rebuilds an insecure database. This file closes that gap.
--
-- Idempotent: safe to run whether the DB is currently in the 003 state or the
-- 007 state. It drops both policy sets by name, re-revokes anon, and recreates
-- the owner-scoped policies from 003 verbatim.
--
-- Also pins search_path on bump_rate_limit (was unset in 013).

-- 1. Ownership column + unique index (no-ops if 003/007 already created them).
alter table public.farmer_profiles
  add column if not exists owner_id uuid references auth.users(id) on delete cascade;

create unique index if not exists farmer_profiles_owner_uidx
  on public.farmer_profiles(owner_id);

-- 2. Drop the permissive MVP policies (from 001 / recreated by 007).
drop policy if exists "allow all - farmer_profiles" on public.farmer_profiles;
drop policy if exists "allow all - farms"           on public.farms;
drop policy if exists "allow all - crop_cycles"     on public.crop_cycles;
drop policy if exists "allow all - farm_expenses"   on public.farm_expenses;

-- 3. Drop the owner-scoped policies too, so the re-create below is clean.
drop policy if exists "own profile - select" on public.farmer_profiles;
drop policy if exists "own profile - insert" on public.farmer_profiles;
drop policy if exists "own profile - update" on public.farmer_profiles;
drop policy if exists "own profile - delete" on public.farmer_profiles;
drop policy if exists "own farms - all"       on public.farms;
drop policy if exists "own crop_cycles - all" on public.crop_cycles;
drop policy if exists "own expenses - all"    on public.farm_expenses;

-- 4. Revoke blanket anon access (007 re-granted it). Authenticated users operate
--    strictly through RLS; service_role keeps its grant for server-side writes.
revoke select, insert, update, delete
  on public.farmer_profiles, public.farms, public.crop_cycles, public.farm_expenses
  from anon;

grant select, insert, update, delete
  on public.farmer_profiles, public.farms, public.crop_cycles, public.farm_expenses
  to authenticated;

-- 5. farmer_profiles — a user sees and edits exactly their own row.
create policy "own profile - select" on public.farmer_profiles
  for select to authenticated using (owner_id = auth.uid());
create policy "own profile - insert" on public.farmer_profiles
  for insert to authenticated with check (owner_id = auth.uid());
create policy "own profile - update" on public.farmer_profiles
  for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "own profile - delete" on public.farmer_profiles
  for delete to authenticated using (owner_id = auth.uid());

-- 6. farms — scoped via their owning farmer_profiles row.
create policy "own farms - all" on public.farms
  for all to authenticated
  using (
    exists (
      select 1 from public.farmer_profiles p
      where p.id = farms.farmer_id and p.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.farmer_profiles p
      where p.id = farms.farmer_id and p.owner_id = auth.uid()
    )
  );

-- 7. crop_cycles — scoped via farms -> farmer_profiles.
create policy "own crop_cycles - all" on public.crop_cycles
  for all to authenticated
  using (
    exists (
      select 1 from public.farms f
      join public.farmer_profiles p on p.id = f.farmer_id
      where f.id = crop_cycles.farm_id and p.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.farms f
      join public.farmer_profiles p on p.id = f.farmer_id
      where f.id = crop_cycles.farm_id and p.owner_id = auth.uid()
    )
  );

-- 8. farm_expenses — scoped via farmer_id -> farmer_profiles.
create policy "own expenses - all" on public.farm_expenses
  for all to authenticated
  using (
    exists (
      select 1 from public.farmer_profiles p
      where p.id = farm_expenses.farmer_id and p.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.farmer_profiles p
      where p.id = farm_expenses.farmer_id and p.owner_id = auth.uid()
    )
  );

-- 9. Pin search_path on the rate-limit function (was unset in 013). It runs as
--    SECURITY INVOKER and is service_role-only, but an unqualified search_path
--    is still a hardening gap flagged by Supabase's linter.
alter function public.bump_rate_limit(text, timestamptz, integer)
  set search_path = public, pg_temp;
