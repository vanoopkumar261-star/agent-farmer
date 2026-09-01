-- 019: Baseline for the four tables the migration history never created.
--
-- `farmer_profiles`, `farms`, `crop_cycles` and `farm_expenses` were created by
-- hand in the Supabase dashboard before this history existed. Every later
-- migration alters, grants and secures them, but nothing in `scripts/sql/`
-- creates them and — the part that matters — **nothing turns RLS on**. It is on
-- in the live database, but the only record of that anywhere in the repo is a
-- comment at the top of 001 asserting it was already true.
--
-- That gap makes two claims false. `SECURITY.md` says replaying this history
-- "produces a secured database"; `README.md` says the migrations "create the
-- farmer/farm/crop tables with per-owner row-level security". A replay onto a
-- fresh project produces neither the tables nor the RLS. And any restore path
-- that loses `relrowsecurity` — a dump/reload, a table rebuilt by hand — brings
-- the database back up with correct-looking policies that are never enforced,
-- silently, because a policy on a table without RLS is inert.
--
-- The definitions below were generated from the live schema (information_schema
-- + pg_constraint + pg_indexes) rather than written from memory, so this file
-- describes what actually exists. Everything is IF NOT EXISTS: on the live
-- database this migration is a no-op except for the RLS assertions at the end,
-- which is the point — it is safe to re-run and it makes the repo the source of
-- truth.
--
-- Ordering note: this file is numbered 019 so the storage fix (018) can be
-- applied first, but its content logically precedes 001. Replaying from scratch
-- works because every statement here is idempotent.

begin;

-- ── Tables ──────────────────────────────────────────────────────────────────

create table if not exists public.farmer_profiles (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  phone         text not null,
  email         text,
  house_lat     double precision,
  house_lng     double precision,
  house_address text,
  created_at    timestamptz default now(),
  owner_id      uuid references auth.users(id) on delete cascade,
  preferences   jsonb not null default '{}'::jsonb
);

create table if not exists public.farms (
  id         uuid primary key default gen_random_uuid(),
  farmer_id  uuid references public.farmer_profiles(id) on delete cascade,
  farm_index integer not null,
  area       double precision not null,
  soil_type  text not null,
  irrigation text not null,
  created_at timestamptz default now()
);

create table if not exists public.crop_cycles (
  id                     uuid primary key default gen_random_uuid(),
  farm_id                uuid references public.farms(id) on delete cascade,
  chosen_crop            text not null,
  seeding_date           date not null,
  expected_yield         text,
  created_at             timestamptz default now(),
  estimated_harvest_date date
);

create table if not exists public.farm_expenses (
  id         uuid primary key default gen_random_uuid(),
  farm_id    uuid references public.farms(id) on delete cascade,
  farmer_id  uuid references public.farmer_profiles(id) on delete cascade,
  item_name  text not null,
  amount     numeric not null,
  kind       text not null default 'expense',
  category   text not null default 'Other',
  txn_date   date not null default current_date,
  created_at timestamptz default now(),
  constraint farm_expenses_kind_chk check (kind = any (array['expense'::text, 'income'::text]))
);

-- ── Indexes (added by later migrations; repeated here so a replay matches) ───

create unique index if not exists farmer_profiles_owner_uidx on public.farmer_profiles(owner_id);
create index        if not exists farm_expenses_farmer_idx   on public.farm_expenses(farmer_id);
create index        if not exists farm_expenses_date_idx     on public.farm_expenses(txn_date);

-- ── RLS: the statements that were missing ───────────────────────────────────
--
-- Without these, the owner policies in 015 exist but are never consulted.

alter table public.farmer_profiles enable row level security;
alter table public.farms           enable row level security;
alter table public.crop_cycles     enable row level security;
alter table public.farm_expenses   enable row level security;

-- FORCE additionally subjects the *table owner* to RLS, closing the case where
-- something connects as `postgres` (the dashboard SQL editor, scripts/db-exec.mjs)
-- and reads across tenants without meaning to.
--
-- Applied only to these four. It must NOT be applied to `security_audit`,
-- `feedback` or `api_rate_limits`: those have RLS enabled with zero policies by
-- design, and `audit_farmer_profiles()` is SECURITY DEFINER — it writes to
-- `security_audit` as the owner, so forcing RLS there would make the audit
-- insert fail and take every write to `farmer_profiles` down with it.
--
-- `service_role` is unaffected either way: it bypasses RLS through the BYPASSRLS
-- role attribute, not through table ownership.
alter table public.farmer_profiles force row level security;
alter table public.farms           force row level security;
alter table public.crop_cycles     force row level security;
alter table public.farm_expenses   force row level security;

-- ── Migration bookkeeping ───────────────────────────────────────────────────
--
-- Nothing tracks which of these files have run, and they have drifted: `008`
-- creates `mandi_geocache`, which does not exist in the live database. Record
-- what is applied so the next person can tell the changelog from the schema.

create table if not exists public.schema_migrations (
  version    text primary key,
  applied_at timestamptz not null default now()
);

alter table public.schema_migrations enable row level security;
revoke all on public.schema_migrations from anon, authenticated;
grant select, insert on public.schema_migrations to service_role;

commit;
