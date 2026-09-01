-- 018: Actually make the leaf-scan bucket private.
--
-- 014 was written to close a cross-tenant exposure of farmers' field photos. It
-- did not. Two independent bugs stacked, and the bucket stayed world-readable:
-- verified live by listing every farmer's folder and downloading a scan using
-- nothing but the anon key that ships inside the web bundle and the mobile APK.
--
-- Bug 1 — the permissive policies from 005 were never dropped.
--   005_memory.sql created the bucket public, with:
--     "leaf-scans public read"          for select to public  using (bucket_id = 'leaf-scans')
--     "leaf-scans authenticated insert" for insert to authenticated with check (bucket_id = ...)
--   014 dropped only its own three "own *" names, so those two survived. Postgres
--   OR's permissive policies together, so the blanket public read overrode every
--   owner-scoped rule 014 added. Flipping the bucket to `public = false` only
--   closed the credential-free CDN URL; the authenticated object endpoint still
--   evaluates RLS, and RLS said yes to everyone.
--
-- Bug 2 — name shadowing made 014's replacements dead policies.
--   014 wrote `(storage.foldername(name))[1]` inside
--     exists (select 1 from public.farmer_profiles p where ...)
--   `farmer_profiles` also has a `name` column, so the unqualified `name`
--   resolved to the *farmer's name*, not the object path. pg_policies confirms
--   Postgres stored it as `storage.foldername(p.name)`. A farmer's name is never
--   their profile UUID, so all three policies were permanently false — they
--   granted nothing, and only bug 1 kept scan history working at all.
--
-- Both halves have to land together: dropping the permissive policies without
-- fixing the qualification would take scan history from "visible to everyone" to
-- "visible to no one".
--
-- Objects are stored at `{farmer_profiles.id}/{timestamp}.{ext}`
-- (src/lib/history.ts), so the first path segment is the owning profile.

begin;

-- Bug 1: the two survivors from 005. These are the actual exposure.
drop policy if exists "leaf-scans public read"          on storage.objects;
drop policy if exists "leaf-scans authenticated insert" on storage.objects;

-- Bug 2: recreate 014's policies with `objects.name` explicitly qualified so it
-- cannot rebind to farmer_profiles.name again.
drop policy if exists "leaf-scans own read"   on storage.objects;
drop policy if exists "leaf-scans own insert" on storage.objects;
drop policy if exists "leaf-scans own update" on storage.objects;
drop policy if exists "leaf-scans own delete" on storage.objects;

create policy "leaf-scans own read" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'leaf-scans'
    and exists (
      select 1 from public.farmer_profiles p
      where p.owner_id = auth.uid()
        and p.id::text = (storage.foldername(objects.name))[1]
    )
  );

create policy "leaf-scans own insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'leaf-scans'
    and exists (
      select 1 from public.farmer_profiles p
      where p.owner_id = auth.uid()
        and p.id::text = (storage.foldername(objects.name))[1]
    )
  );

-- 014 omitted UPDATE. Uploads use `upsert: false` today, so nothing needs it yet;
-- it is here so a future upsert fails closed against the owner check rather than
-- falling through to no policy at all.
create policy "leaf-scans own update" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'leaf-scans'
    and exists (
      select 1 from public.farmer_profiles p
      where p.owner_id = auth.uid()
        and p.id::text = (storage.foldername(objects.name))[1]
    )
  )
  with check (
    bucket_id = 'leaf-scans'
    and exists (
      select 1 from public.farmer_profiles p
      where p.owner_id = auth.uid()
        and p.id::text = (storage.foldername(objects.name))[1]
    )
  );

create policy "leaf-scans own delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'leaf-scans'
    and exists (
      select 1 from public.farmer_profiles p
      where p.owner_id = auth.uid()
        and p.id::text = (storage.foldername(objects.name))[1]
    )
  );

-- Belt and braces: 014 set this, but it is the difference between "needs a
-- credential" and "needs nothing at all", so assert it here too.
update storage.buckets
set
  public             = false,
  file_size_limit    = 5242880,
  allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']
where id = 'leaf-scans';

commit;
