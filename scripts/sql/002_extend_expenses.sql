-- Extend farm_expenses into a full income/expense ledger for the Expense Tracker.
alter table public.farm_expenses
  add column if not exists farmer_id uuid references public.farmer_profiles(id) on delete cascade,
  add column if not exists kind text not null default 'expense',
  add column if not exists category text not null default 'Other',
  add column if not exists txn_date date not null default current_date;

-- constrain kind to expense | income
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'farm_expenses_kind_chk'
  ) then
    alter table public.farm_expenses
      add constraint farm_expenses_kind_chk check (kind in ('expense', 'income'));
  end if;
end $$;

create index if not exists farm_expenses_farmer_idx on public.farm_expenses(farmer_id);
create index if not exists farm_expenses_date_idx on public.farm_expenses(txn_date);
