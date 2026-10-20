-- mandi_cache.retail must be nullable.
--
-- 034 declared it `jsonb not null default '[]'`, copying the shape of the
-- `missing` and `ladder` columns beside it. Those are lists, and an empty list
-- is a real value. `retail` is not a list: it is one row from a vegetable
-- retail table, or nothing at all.
--
-- "Nothing at all" is the normal case for most of the crop catalogue. Paddy,
-- maize and cotton are not sold by the kilo in a vegetable market, so no
-- retail figure exists for them and the code correctly writes null.
--
-- The constraint rejected every one of those writes. Because writeCache
-- swallowed its error, the warm job reported 36 mandi targets "done" while
-- only 9 rows existed — the nine vegetable combinations. The failure was
-- invisible precisely where it mattered. The error is logged now as well.

begin;

alter table public.mandi_cache alter column retail drop not null;
alter table public.mandi_cache alter column retail drop default;

commit;
