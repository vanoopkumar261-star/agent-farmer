-- 020: Least privilege on the owner tables, and make the audit log usable.
--
-- Two problems, both caused by a revoke that named fewer privileges than the
-- grant it was undoing.
--
-- 1. Supabase's default privileges GRANT ALL on new public tables to anon and
--    authenticated. Every migration that tried to walk that back revoked only
--    the four DML privileges:
--
--      revoke select, insert, update, delete on ... from anon;   -- 015:40-42
--
--    TRUNCATE, REFERENCES and TRIGGER survived. Live state confirms it: `anon`
--    holds exactly those three on every owner table.
--
--    TRUNCATE matters because **RLS does not apply to TRUNCATE**. A policy that
--    carefully scopes every row to its owner is simply not consulted; the only
--    gate is the table privilege, which anon has. PostgREST does not expose
--    TRUNCATE today, so this is latent rather than exploitable right now — but
--    it is one `security definer` RPC away from being a full-database wipe, and
--    there is no reason for either role to hold it.
--
-- 2. `security_audit` ended up with the inverse of what 016 intended. Live,
--    `service_role` holds TRUNCATE, REFERENCES and TRIGGER — and no SELECT or
--    INSERT. The one role that is supposed to be able to read the append-only
--    audit trail cannot (42501), and can destroy it. Writes only work because
--    `audit_farmer_profiles()` is SECURITY DEFINER and runs as the owner.

begin;

-- ── 1. Owner tables: nothing beyond DML, and nothing at all for anon ─────────

revoke truncate, references, trigger on
  public.farmer_profiles,
  public.farms,
  public.crop_cycles,
  public.farm_expenses,
  public.farm_tasks,
  public.health_snapshots,
  public.crop_health_records,
  public.chat_messages,
  public.notifications,
  public.soil_readings
from anon, authenticated;

-- anon should reach none of these at all. RLS already denies it (no policy
-- names anon), but that is one control; this is the second.
revoke all on
  public.farmer_profiles,
  public.farms,
  public.crop_cycles,
  public.farm_expenses,
  public.farm_tasks,
  public.health_snapshots,
  public.crop_health_records,
  public.chat_messages,
  public.notifications,
  public.soil_readings
from anon;

-- Stop the defaults from re-granting on anything created later.
alter default privileges in schema public revoke all on tables from anon;

-- ── 2. security_audit: readable by the role that is meant to read it ────────

grant select, insert on public.security_audit to service_role;
revoke truncate, references, trigger on public.security_audit from service_role;

-- An append-only trail should not be rewritable or erasable by anyone.
revoke update, delete on public.security_audit from service_role;

-- Same reasoning for the other two service-role-only tables: they are written
-- through the API, never truncated by it.
revoke truncate on public.feedback, public.api_rate_limits from service_role;

commit;
