-- Optional photo for one specific variation (one size in one color).
-- Display priority: variation photo -> size photo -> product photo.
alter table public.items
  add column variation_image_path text
  check (variation_image_path is null or (length(variation_image_path) <= 300 and variation_image_path !~ '^data:'));

drop view if exists public.items_with_status;
create view public.items_with_status
with (security_invoker = true) as
select i.*, public.stock_status(i.quantity, i.low_stock_threshold) as stock_status
from public.items i;
revoke all on public.items_with_status from anon;
grant select on public.items_with_status to authenticated;
