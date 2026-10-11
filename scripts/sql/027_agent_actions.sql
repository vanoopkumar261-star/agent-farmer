-- 027: Durable audit log for the voice/agent tool-calling gateway.
--
-- Mirrors the mobile app's local AsyncStorage ring buffer
-- (agent-farmer-mobile/src/lib/agent/log.ts), which was built ahead of this
-- table specifically so it would have somewhere durable to write into once
-- this migration landed. The local ring survives a warm session; this table
-- survives a reinstall, a lost phone, or a support request ("what did the
-- assistant do to my account on Tuesday").
--
-- Written by the MOBILE CLIENT, not by /api/agent/turn. The turn endpoint only
-- decides which tool to call with which (farm_index-based, never a raw UUID)
-- arguments; the actual Supabase write and this log entry are both made by the
-- client's own RLS-scoped session, the same pattern farm_expenses and
-- farm_tasks already use. No service-role path exists into this table.
--
-- `inverse` carries what would undo the action ({tool, args}), null when the
-- tool has no defined inverse (e.g. navigation). `undone` is set once the
-- farmer says "undo" and the inverse tool has been executed — see
-- src/lib/agent/log.ts's markUndone().

begin;

create table if not exists public.agent_actions (
  id         uuid primary key default gen_random_uuid(),
  farmer_id  uuid not null references public.farmer_profiles(id) on delete cascade,
  tool       text not null,
  args       jsonb not null default '{}'::jsonb,
  summary    text not null,
  inverse    jsonb,
  undone     boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists agent_actions_farmer_idx  on public.agent_actions(farmer_id);
create index if not exists agent_actions_created_idx on public.agent_actions(created_at);

alter table public.agent_actions enable row level security;
alter table public.agent_actions force row level security;

create policy "own agent_actions - all" on public.agent_actions
  for all to authenticated
  using (
    exists (
      select 1 from public.farmer_profiles p
      where p.id = agent_actions.farmer_id and p.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.farmer_profiles p
      where p.id = agent_actions.farmer_id and p.owner_id = auth.uid()
    )
  );

commit;
