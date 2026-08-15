-- 007: TEMPORARY revert of 003 — restore the permissive MVP policies.
--
-- Why: the deployed Vercel build is still the OLD no-auth code (commit 4a300ef),
-- which talks to Supabase with the anon key and has no session. After 003 the
-- anon grants were revoked, so prod reads nothing and the live site looks empty.
-- This puts the DB back into its pre-auth state (identical to 001) so the
-- currently-deployed build works again.
--
-- ⚠️ This is deliberately temporary. While it is applied, anyone holding the
-- anon key (which ships in client JS, i.e. effectively public) can read and
-- write every row. Re-apply 003_auth_ownership.sql as soon as the auth-enabled
-- build is deployed and verified.
--
-- Not reverted (intentionally): the owner_id column and its unique index, and
-- migrations 004/005/006. Those are purely additive — the old build never
-- references them, and keeping them means re-applying 003 is a one-step job.
-- (Postgres unique indexes permit multiple NULLs, so old-style inserts that
-- leave owner_id NULL continue to work.)

-- 1. Drop the per-user scoped policies added by 003.
drop policy if exists "own profile - select" on public.farmer_profiles;
drop policy if exists "own profile - insert" on public.farmer_profiles;
drop policy if exists "own profile - update" on public.farmer_profiles;
drop policy if exists "own profile - delete" on public.farmer_profiles;
drop policy if exists "own farms - all"       on public.farms;
drop policy if exists "own crop_cycles - all" on public.crop_cycles;
drop policy if exists "own expenses - all"    on public.farm_expenses;

-- 2. Restore the blanket grants that 003 revoked.
grant select, insert, update, delete
  on public.farmer_profiles, public.farms, public.crop_cycles, public.farm_expenses
  to anon, authenticated, service_role;

-- 3. Recreate the permissive MVP policies verbatim from 001.
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
