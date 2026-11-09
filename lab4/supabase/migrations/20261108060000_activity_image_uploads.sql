insert into storage.buckets (id, name, public)
values ('activity-images', 'activity-images', true)
on conflict (id) do update set public = excluded.public;

create policy "organisers upload activity images"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'activity-images'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and exists (
    select 1
    from public.activities
    where id::text = (storage.foldername(name))[2]
      and organiser_id = (select auth.uid())
      and source = 'organiser'
  )
);

create policy "public read activity images"
on storage.objects for select to public
using (bucket_id = 'activity-images');

create policy "organisers update activity images"
on storage.objects for update to authenticated
using (
  bucket_id = 'activity-images'
  and owner_id = (select auth.uid())::text
)
with check (
  bucket_id = 'activity-images'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy "organisers delete activity images"
on storage.objects for delete to authenticated
using (
  bucket_id = 'activity-images'
  and owner_id = (select auth.uid())::text
);
