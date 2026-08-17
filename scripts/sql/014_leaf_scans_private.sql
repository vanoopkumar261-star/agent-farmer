-- 014: Make the leaf-scan bucket private, bounded and typed.
--
-- `leaf-scans` was created public, with no size limit and no MIME allowlist.
-- Public means the object URL needs no credentials at all: anyone holding one —
-- and the URLs were stored verbatim in crop_health_records — could fetch a
-- farmer's crop photographs. Those photographs are of that farmer's land, and
-- phone cameras write GPS coordinates into EXIF, so the exposure is the farm's
-- location, not just a picture of a leaf.
--
-- After this migration the object URL alone grants nothing. The app mints a
-- short-lived signed URL per scan at render time, server-side.
--
-- The limits are set here as well as in the route handler. The handler gives the
-- farmer a readable message; this is the backstop that holds even if a future
-- caller forgets to check.

update storage.buckets
set
  public             = false,
  file_size_limit    = 5242880,                                   -- 5 MB
  allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']
where id = 'leaf-scans';

-- Objects are stored at `{farmer_profiles.id}/{timestamp}.{ext}`, so the first
-- path segment is the owning profile. These policies let a signed-in farmer
-- reach only their own prefix; the service role bypasses RLS and is what the
-- route handler uses to write and to sign.
drop policy if exists "leaf-scans own read"   on storage.objects;
drop policy if exists "leaf-scans own insert" on storage.objects;
drop policy if exists "leaf-scans own delete" on storage.objects;

create policy "leaf-scans own read" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'leaf-scans'
    and exists (
      select 1 from public.farmer_profiles p
      where p.owner_id = auth.uid()
        and p.id::text = (storage.foldername(name))[1]
    )
  );

create policy "leaf-scans own insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'leaf-scans'
    and exists (
      select 1 from public.farmer_profiles p
      where p.owner_id = auth.uid()
        and p.id::text = (storage.foldername(name))[1]
    )
  );

create policy "leaf-scans own delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'leaf-scans'
    and exists (
      select 1 from public.farmer_profiles p
      where p.owner_id = auth.uid()
        and p.id::text = (storage.foldername(name))[1]
    )
  );
