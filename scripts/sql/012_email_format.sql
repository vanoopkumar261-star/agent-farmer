-- 012: Enforce email structure in the database.
--
-- The forms validate email format, and /api/feedback validates it again on the
-- server. Neither is the last line: registration calls supabase.auth.signUp
-- straight from the browser and the farmer profile is written with the anon key
-- under RLS, so for those paths "the server" is Postgres itself. A CHECK
-- constraint is therefore the only layer no client can talk its way around.
--
-- The grammar mirrors EMAIL_RE in src/lib/validation.ts exactly:
--   local   dot-separated atoms — a dot must join two of them, which is what
--           rejects ".x@d.com", "x.@d.com" and "a..b@d.com"
--   domain  labels that start and end alphanumeric, then a 2+ letter TLD —
--           rejecting "x@d", "x@.com", "x@d." and "x@d-.com"
--
-- Keep the two in step. If one is ever loosened without the other, the app
-- accepts an address that the insert then rejects, and the farmer sees a
-- database error instead of a field message.

-- farmer_profiles.email is nullable and some rows predate the rule, so the
-- constraint has to tolerate NULL rather than force a backfill.
alter table public.farmer_profiles
  drop constraint if exists farmer_profiles_email_format;

alter table public.farmer_profiles
  add constraint farmer_profiles_email_format check (
    email is null
    or email ~ '^[A-Za-z0-9!#$%&''*+/=?^_`{|}~-]+(\.[A-Za-z0-9!#$%&''*+/=?^_`{|}~-]+)*@([A-Za-z0-9]([A-Za-z0-9-]*[A-Za-z0-9])?\.)+[A-Za-z]{2,}$'
    and length(email) <= 254
  );

-- feedback.email is NOT NULL, so no null branch here.
alter table public.feedback
  drop constraint if exists feedback_email_format;

alter table public.feedback
  add constraint feedback_email_format check (
    email ~ '^[A-Za-z0-9!#$%&''*+/=?^_`{|}~-]+(\.[A-Za-z0-9!#$%&''*+/=?^_`{|}~-]+)*@([A-Za-z0-9]([A-Za-z0-9-]*[A-Za-z0-9])?\.)+[A-Za-z]{2,}$'
    and length(email) <= 254
  );

comment on constraint farmer_profiles_email_format on public.farmer_profiles is
  'Mirrors EMAIL_RE in src/lib/validation.ts — change both together.';
comment on constraint feedback_email_format on public.feedback is
  'Mirrors EMAIL_RE in src/lib/validation.ts — change both together.';
