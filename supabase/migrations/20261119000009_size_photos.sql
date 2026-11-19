-- Optional photo per size. Stored on each variation row of that size (so
-- every color of size S shares it), separate from the product photo in
-- image_path. Same bucket and path rules as product photos.
alter table public.items
  add column variant_image_path text
  check (variant_image_path is null or (length(variant_image_path) <= 300 and variant_image_path !~ '^data:'));

drop view if exists public.items_with_status;
create view public.items_with_status
with (security_invoker = true) as
select i.*, public.stock_status(i.quantity, i.low_stock_threshold) as stock_status
from public.items i;
revoke all on public.items_with_status from anon;
grant select on public.items_with_status to authenticated;
