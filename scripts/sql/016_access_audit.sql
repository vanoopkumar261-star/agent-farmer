-- 016: Lightweight access audit for the PII table.
--
-- The landing page claims "row-level security and audited access". RLS was
-- real; the audit was not. This adds it for farmer_profiles — the row that
-- holds name, phone, email, address and house coordinates — recording who
-- (auth.uid()) changed what, and when.
--
-- Scope is deliberately narrow: an AFTER trigger on the one PII table, writing
-- to an append-only table that no API role can read or modify. Reads are via
-- the Supabase dashboard / service role only.

create table if not exists public.security_audit (
  id              bigserial primary key,
  occurred_at     timestamptz not null default now(),
  actor           uuid,            -- auth.uid() at the time; null for service-role / system
  action          text not null,   -- INSERT | UPDATE | DELETE
  table_name      text not null,
  row_id          uuid,
  changed_columns text[]
);

create index if not exists security_audit_occurred_at_idx
  on public.security_audit (occurred_at desc);
create index if not exists security_audit_actor_idx
  on public.security_audit (actor);

alter table public.security_audit enable row level security;

-- No policy is created, so PostgREST exposes nothing. Also hard-revoke the
-- default grants: this table is write-once by the trigger and read only out of
-- band.
revoke all on public.security_audit from anon, authenticated;

-- The trigger function runs SECURITY DEFINER (as the table owner), so it can
-- insert without any role being granted write access here.
create or replace function public.audit_farmer_profiles()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  changed text[];
begin
  if (tg_op = 'UPDATE') then
    select array_agg(o.key)
      into changed
      from jsonb_each(to_jsonb(old)) o
      join jsonb_each(to_jsonb(new)) n using (key)
     where o.value is distinct from n.value;
  end if;

  insert into public.security_audit (actor, action, table_name, row_id, changed_columns)
  values (
    auth.uid(),
    tg_op,
    tg_table_name,
    coalesce(new.id, old.id),
    changed
  );

  return coalesce(new, old);
end;
$$;

revoke all on function public.audit_farmer_profiles() from public, anon, authenticated;

drop trigger if exists trg_audit_farmer_profiles on public.farmer_profiles;
create trigger trg_audit_farmer_profiles
  after insert or update or delete on public.farmer_profiles
  for each row execute function public.audit_farmer_profiles();
