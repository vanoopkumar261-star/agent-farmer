-- 010: make task completions daily.
--
-- Why: task keys are stage-derived and date-less (`scout-early-<farmId>`), and
-- `loadDoneKeys` fetched every row with status='done' for the farmer with no
-- date filter. Ticking "Inspect germination" on day 1 therefore left it ticked
-- on day 2, 3 and every day after until the crop changed stage — wrong for a
-- card headed "Today's Tasks", and it silently hid the day's real work.
--
-- The fix is to make (farmer, task, day) the unit of completion. `due_date`
-- already existed on this table but was never written to.

-- 1. Every existing row belongs to the day it was last touched.
update public.farm_tasks
   set due_date = coalesce(due_date, updated_at::date)
 where due_date is null;

alter table public.farm_tasks
  alter column due_date set default current_date;

alter table public.farm_tasks
  alter column due_date set not null;

-- 2. The same task may now exist once per day, not once ever.
drop index if exists public.farm_tasks_owner_key_uidx;

create unique index if not exists farm_tasks_owner_key_day_uidx
  on public.farm_tasks (farmer_id, task_key, due_date);

-- 3. Reading "what did they complete on day X" is the hot path now.
create index if not exists farm_tasks_farmer_due_idx
  on public.farm_tasks (farmer_id, due_date);
