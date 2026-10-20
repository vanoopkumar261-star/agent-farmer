-- The field cap, enforced where it cannot be bypassed.
--
-- ── Why this is a trigger and not a route check ──────────────────────────────
--
-- Farms are created by `createFarms()` in src/lib/db.ts, which runs in the
-- browser against PostgREST with the farmer's own session. There is no API
-- route in between to put a guard in. So the modal's "you already have 2
-- fields" is advice, and anyone with the console can insert a third.
--
-- Every other limit in this feature is refused by a route. This one has to be
-- refused by the database or it is not refused at all.
--
-- ── Why the numbers live in a table ──────────────────────────────────────────
--
-- src/lib/plans.ts is the single source of truth for every tier limit, and
-- hard-coding 2/5/20 into PL/pgSQL would quietly fork that truth the first
-- time a price or a cap changed. A table at least makes the two agree by
-- editing data rather than shipping DDL — and the dry-run harness can compare
-- them, which a literal buried in a function body could never be.

begin;

create table if not exists public.plan_field_limits (
  plan       text primary key,
  max_fields integer not null
);

insert into public.plan_field_limits (plan, max_fields) values
  ('free', 2),
  ('pro', 5),
  ('elite', 20)
on conflict (plan) do update set max_fields = excluded.max_fields;

alter table public.plan_field_limits enable row level security;
-- Readable by signed-in farmers: the cap is printed on the pricing cards
-- anyway, so there is nothing here worth hiding, and a client that can read it
-- can explain the refusal.
grant select on public.plan_field_limits to authenticated;
grant select, insert, update, delete on public.plan_field_limits to service_role;

drop policy if exists "plan field limits readable" on public.plan_field_limits;
create policy "plan field limits readable"
  on public.plan_field_limits for select to authenticated using (true);

create or replace function public.enforce_field_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  farmer_plan text;
  cap         integer;
  existing    integer;
begin
  select plan into farmer_plan from public.farmer_profiles where id = new.farmer_id;
  -- No profile, or a plan this table has never heard of: let the insert
  -- through. A cap is a product rule, and failing closed on a missing lookup
  -- would block a farmer over a data gap that is not their doing.
  if farmer_plan is null then
    return new;
  end if;

  select max_fields into cap from public.plan_field_limits where plan = farmer_plan;
  if cap is null then
    return new;
  end if;

  select count(*) into existing from public.farms where farmer_id = new.farmer_id;

  if existing >= cap then
    raise exception
      'Field limit reached: this plan covers % fields and you already have %.', cap, existing
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

drop trigger if exists farms_field_limit on public.farms;
create trigger farms_field_limit
  before insert on public.farms
  for each row execute function public.enforce_field_limit();

comment on function public.enforce_field_limit() is
  'Refuses a farm insert past the plan cap. Mirrors fieldLimit() in src/lib/plans.ts via plan_field_limits.';

commit;
