-- 005: Memory — saved disease scans + chat history (Phase 4).
--
-- Owner-scoped RLS mirrors 003/004. Run AFTER 003. Until this runs, the app
-- degrades gracefully: scans and chats simply aren't persisted (the helpers in
-- src/lib/history.ts no-op), so nothing breaks.

-- Per-crop health record: one row per disease scan → the crop's health timeline.
create table if not exists public.crop_health_records (
  id uuid primary key default gen_random_uuid(),
  farmer_id uuid not null references public.farmer_profiles(id) on delete cascade,
  farm_id uuid references public.farms(id) on delete set null,
  crop_id uuid references public.crop_cycles(id) on delete set null,
  crop_name text,
  disease text,
  healthy boolean not null default false,
  confidence numeric,
  severity text,
  affected_area_pct numeric,
  summary text,
  source text,
  image_url text,
  created_at timestamptz not null default now()
);
create index if not exists chr_farmer_idx on public.crop_health_records(farmer_id);
create index if not exists chr_created_idx on public.crop_health_records(created_at);

-- Assistant chat history so conversations survive reloads and feed the AI's memory.
create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  farmer_id uuid not null references public.farmer_profiles(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  created_at timestamptz not null default now()
);
create index if not exists chat_farmer_idx on public.chat_messages(farmer_id, created_at);

alter table public.crop_health_records enable row level security;
alter table public.chat_messages enable row level security;

grant select, insert, update, delete
  on public.crop_health_records, public.chat_messages
  to authenticated, service_role;

create policy "own crop_health_records - all" on public.crop_health_records
  for all to authenticated
  using (
    exists (select 1 from public.farmer_profiles p where p.id = crop_health_records.farmer_id and p.owner_id = auth.uid())
  )
  with check (
    exists (select 1 from public.farmer_profiles p where p.id = crop_health_records.farmer_id and p.owner_id = auth.uid())
  );

create policy "own chat_messages - all" on public.chat_messages
  for all to authenticated
  using (
    exists (select 1 from public.farmer_profiles p where p.id = chat_messages.farmer_id and p.owner_id = auth.uid())
  )
  with check (
    exists (select 1 from public.farmer_profiles p where p.id = chat_messages.farmer_id and p.owner_id = auth.uid())
  );

-- Public storage bucket for leaf-scan images.
insert into storage.buckets (id, name, public)
  values ('leaf-scans', 'leaf-scans', true)
  on conflict (id) do nothing;

drop policy if exists "leaf-scans public read" on storage.objects;
create policy "leaf-scans public read" on storage.objects
  for select to public using (bucket_id = 'leaf-scans');

drop policy if exists "leaf-scans authenticated insert" on storage.objects;
create policy "leaf-scans authenticated insert" on storage.objects
  for insert to authenticated with check (bucket_id = 'leaf-scans');
