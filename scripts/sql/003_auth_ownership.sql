-- 003: Per-farmer ownership + scoped RLS.
--
-- Replaces the intentionally-permissive MVP policies from 001 (which let anyone
-- read/write every row) with real per-user isolation now that Supabase Auth is
-- wired up. Each farmer_profiles row is owned by an auth user; farms, crop_cycles
-- and farm_expenses are scoped through their farmer_profiles owner.
--
-- ⚠️ Ordering: run this ONLY together with the auth-enabled app build. Once the
-- permissive policies are dropped and anon access is revoked, the old (no-auth)
-- app can no longer read data. Existing rows created before auth have a NULL
-- owner_id and will be invisible — that's expected for the demo dataset.

-- 1. Ownership column tying a profile to a Supabase Auth user (one profile/user).
alter table public.farmer_profiles
  add column if not exists owner_id uuid references auth.users(id) on delete cascade;

create unique index if not exists farmer_profiles_owner_uidx
  on public.farmer_profiles(owner_id);

-- 2. Drop the permissive MVP policies.
drop policy if exists "allow all - farmer_profiles" on public.farmer_profiles;
drop policy if exists "allow all - farms"           on public.farms;
drop policy if exists "allow all - crop_cycles"     on public.crop_cycles;
drop policy if exists "allow all - farm_expenses"   on public.farm_expenses;

-- 3. Revoke blanket anon access. Authenticated users operate strictly through RLS.
revoke select, insert, update, delete
  on public.farmer_profiles, public.farms, public.crop_cycles, public.farm_expenses
  from anon;

-- 4. farmer_profiles — a user sees and edits exactly their own row.
create policy "own profile - select" on public.farmer_profiles
  for select to authenticated using (owner_id = auth.uid());
create policy "own profile - insert" on public.farmer_profiles
  for insert to authenticated with check (owner_id = auth.uid());
create policy "own profile - update" on public.farmer_profiles
  for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "own profile - delete" on public.farmer_profiles
  for delete to authenticated using (owner_id = auth.uid());

-- 5. farms — scoped via their owning farmer_profiles row.
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

-- 6. crop_cycles — scoped via farms -> farmer_profiles.
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

-- 7. farm_expenses — scoped via farmer_id -> farmer_profiles.
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
