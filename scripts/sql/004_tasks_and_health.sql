-- 004: Interactive farm tasks + daily health snapshots (Phase 2).
--
-- Owner-scoped RLS mirrors 003. Run AFTER 003 (it depends on farmer_profiles.owner_id).
-- Until this runs, the app degrades gracefully: task checkboxes toggle in-session
-- but don't persist, and health history falls back to a flat line.

-- Interactive, per-farmer task list. task_key is the stable id emitted by the
-- agronomy engine (src/lib/agronomy.ts) so completions upsert without duplicating.
create table if not exists public.farm_tasks (
  id uuid primary key default gen_random_uuid(),
  farmer_id uuid not null references public.farmer_profiles(id) on delete cascade,
  farm_id uuid references public.farms(id) on delete cascade,
  crop_id uuid references public.crop_cycles(id) on delete cascade,
  task_key text not null,
  title text not null,
  meta text,
  category text not null default 'general',
  tone text not null default 'green',
  status text not null default 'open' check (status in ('open', 'done', 'snoozed')),
  due_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists farm_tasks_owner_key_uidx on public.farm_tasks(farmer_id, task_key);
create index if not exists farm_tasks_farmer_idx on public.farm_tasks(farmer_id);

-- One health score per farmer per day → builds real sparkline history over time.
create table if not exists public.health_snapshots (
  id uuid primary key default gen_random_uuid(),
  farmer_id uuid not null references public.farmer_profiles(id) on delete cascade,
  snapshot_date date not null default current_date,
  score int not null,
  created_at timestamptz not null default now()
);
create unique index if not exists health_snapshots_owner_date_uidx
  on public.health_snapshots(farmer_id, snapshot_date);

alter table public.farm_tasks enable row level security;
alter table public.health_snapshots enable row level security;

grant select, insert, update, delete
  on public.farm_tasks, public.health_snapshots
  to authenticated, service_role;

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
  );

create policy "own health_snapshots - all" on public.health_snapshots
  for all to authenticated
  using (
    exists (
      select 1 from public.farmer_profiles p
      where p.id = health_snapshots.farmer_id and p.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.farmer_profiles p
      where p.id = health_snapshots.farmer_id and p.owner_id = auth.uid()
    )
  );
