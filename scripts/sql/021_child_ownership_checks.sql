-- 021: Validate farm_id / crop_id ownership on write, not just farmer_id.
--
-- The child tables all check that the row's `farmer_id` belongs to the caller,
-- and stop there — while also carrying `farm_id` / `crop_id` foreign keys that
-- nothing validates. So a signed-in farmer can insert a row they legitimately
-- own that points at *another tenant's* farm.
--
-- It is not a read leak: RLS on `farms` still hides the referenced row. What it
-- gives is (a) an existence oracle — a valid foreign key succeeds, an invented
-- UUID raises a FK violation, so arbitrary farm ids can be probed one at a time
-- — and (b) a way to attach rows to a victim's ON DELETE CASCADE graph, so that
-- deleting their own farm silently deletes an attacker's rows, or leaves the
-- attacker's rows to be counted against them.
--
-- `crop_cycles` already does this correctly (015:75-90), walking
-- crop_cycles.farm_id -> farms -> farmer_profiles. This applies the same walk to
-- the tables that were left checking only one level.
--
-- Both columns are nullable everywhere, and a null reference is legitimate (a
-- scan not tied to a specific farm), so each clause is `is null or owned`.
--
-- USING is deliberately left as the farmer_id check alone: it decides which
-- existing rows are visible, and tightening it would hide any historical row
-- whose farm_id predates this rule. WITH CHECK governs what may be written,
-- which is where the gap actually was.

begin;

-- ── farm_tasks ──────────────────────────────────────────────────────────────
drop policy if exists "own farm_tasks - all" on public.farm_tasks;

create policy "own farm_tasks - all" on public.farm_tasks
  for all to authenticated
  using (
    exists (
      select 1 from public.farmer_profiles p
      where p.id = farm_tasks.farmer_id and p.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.farmer_profiles p
      where p.id = farm_tasks.farmer_id and p.owner_id = auth.uid()
    )
    and (
      farm_tasks.farm_id is null
      or exists (
        select 1 from public.farms f
        join public.farmer_profiles p on p.id = f.farmer_id
        where f.id = farm_tasks.farm_id and p.owner_id = auth.uid()
      )
    )
    and (
      farm_tasks.crop_id is null
      or exists (
        select 1 from public.crop_cycles c
        join public.farms f on f.id = c.farm_id
        join public.farmer_profiles p on p.id = f.farmer_id
        where c.id = farm_tasks.crop_id and p.owner_id = auth.uid()
      )
    )
  );

-- ── crop_health_records ─────────────────────────────────────────────────────
drop policy if exists "own crop_health_records - all" on public.crop_health_records;

create policy "own crop_health_records - all" on public.crop_health_records
  for all to authenticated
  using (
    exists (
      select 1 from public.farmer_profiles p
      where p.id = crop_health_records.farmer_id and p.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.farmer_profiles p
      where p.id = crop_health_records.farmer_id and p.owner_id = auth.uid()
    )
    and (
      crop_health_records.farm_id is null
      or exists (
        select 1 from public.farms f
        join public.farmer_profiles p on p.id = f.farmer_id
        where f.id = crop_health_records.farm_id and p.owner_id = auth.uid()
      )
    )
    and (
      crop_health_records.crop_id is null
      or exists (
        select 1 from public.crop_cycles c
        join public.farms f on f.id = c.farm_id
        join public.farmer_profiles p on p.id = f.farmer_id
        where c.id = crop_health_records.crop_id and p.owner_id = auth.uid()
      )
    )
  );

-- ── soil_readings ───────────────────────────────────────────────────────────
drop policy if exists "own soil_readings - all" on public.soil_readings;

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
    and (
      soil_readings.farm_id is null
      or exists (
        select 1 from public.farms f
        join public.farmer_profiles p on p.id = f.farmer_id
        where f.id = soil_readings.farm_id and p.owner_id = auth.uid()
      )
    )
  );

-- ── farm_expenses ───────────────────────────────────────────────────────────
-- farmer_id is nullable here (the table predates the ownership migrations), so
-- a null-farmer row fails the EXISTS and is refused. That is the correct
-- outcome: every new expense must name its owner.
drop policy if exists "own expenses - all" on public.farm_expenses;

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
    and (
      farm_expenses.farm_id is null
      or exists (
        select 1 from public.farms f
        join public.farmer_profiles p on p.id = f.farmer_id
        where f.id = farm_expenses.farm_id and p.owner_id = auth.uid()
      )
    )
  );

commit;
