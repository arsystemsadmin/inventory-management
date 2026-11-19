-- Optional photo per item.
-- Files live in the "item-images" Storage bucket at
--   <business_id>/<store_id>/<random uuid>.<ext>
-- Uploads/changes are limited to the owner or members of that store (same
-- rules as items). Reads are public-by-URL: product photos aren't sensitive
-- and the random file names aren't guessable.

alter table public.items
  add column image_path text
  check (image_path is null or (length(image_path) <= 300 and image_path !~ '^data:'));

-- items_with_status selects i.*, so recreate it to include the new column.
drop view if exists public.items_with_status;
create view public.items_with_status
with (security_invoker = true) as
select i.*, public.stock_status(i.quantity, i.low_stock_threshold) as stock_status
from public.items i;
revoke all on public.items_with_status from anon;
grant select on public.items_with_status to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('item-images', 'item-images', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

-- Path segment 1 = business, segment 2 = store. A malformed store segment
-- fails the uuid cast, which also denies the write.
create policy item_images_insert on storage.objects for insert to authenticated
  with check (
    bucket_id = 'item-images'
    and (storage.foldername(name))[1] = public.current_business_id()::text
    and public.can_access_store(((storage.foldername(name))[2])::uuid)
  );
create policy item_images_update on storage.objects for update to authenticated
  using (
    bucket_id = 'item-images'
    and (storage.foldername(name))[1] = public.current_business_id()::text
    and public.can_access_store(((storage.foldername(name))[2])::uuid)
  );
create policy item_images_delete on storage.objects for delete to authenticated
  using (
    bucket_id = 'item-images'
    and (storage.foldername(name))[1] = public.current_business_id()::text
    and public.can_access_store(((storage.foldername(name))[2])::uuid)
  );
