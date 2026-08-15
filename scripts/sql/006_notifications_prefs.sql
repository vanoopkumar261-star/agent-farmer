-- 006: Notifications + farmer preferences (Phase 5).
-- Owner-scoped RLS mirrors 003. Run after 003. Degrades gracefully until applied.

-- Per-farmer notification preferences live in a jsonb blob on the profile.
alter table public.farmer_profiles
  add column if not exists preferences jsonb not null default '{}'::jsonb;

-- Notifications feed. dedupe_key (from the alert/task) makes sync idempotent.
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  farmer_id uuid not null references public.farmer_profiles(id) on delete cascade,
  dedupe_key text not null,
  kind text not null default 'info',
  title text not null,
  body text,
  read boolean not null default false,
  created_at timestamptz not null default now()
);
create unique index if not exists notifications_owner_key_uidx on public.notifications(farmer_id, dedupe_key);
create index if not exists notifications_farmer_idx on public.notifications(farmer_id, created_at);

alter table public.notifications enable row level security;
grant select, insert, update, delete on public.notifications to authenticated, service_role;

create policy "own notifications - all" on public.notifications
  for all to authenticated
  using (
    exists (select 1 from public.farmer_profiles p where p.id = notifications.farmer_id and p.owner_id = auth.uid())
  )
  with check (
    exists (select 1 from public.farmer_profiles p where p.id = notifications.farmer_id and p.owner_id = auth.uid())
  );
