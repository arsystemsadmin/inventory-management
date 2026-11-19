-- Atomic restock. SECURITY INVOKER: the caller's RLS and the items trigger
-- (setup-lock rules) apply exactly as for a direct update; increases are
-- always allowed for store members, so this works after setup is locked.
create or replace function public.add_stock(p_item_id uuid, p_qty integer)
returns integer
language plpgsql security invoker set search_path = ''
as $$
declare
  v_qty integer;
begin
  if p_qty is null or p_qty <= 0 or p_qty > 100000 then
    raise exception 'INVALID_QUANTITY' using errcode = '22023';
  end if;
  update public.items set quantity = quantity + p_qty
  where id = p_item_id and not archived
  returning quantity into v_qty;
  if v_qty is null then
    raise exception 'ITEM_NOT_FOUND' using errcode = 'P0002';
  end if;
  return v_qty;
end $$;

revoke execute on function public.add_stock(uuid, integer) from public, anon;
grant execute on function public.add_stock(uuid, integer) to authenticated;

-- Atomic stock removal (damaged, miscounted...). SECURITY INVOKER, so the
-- items trigger allows it only for owners or while the store is in setup
-- mode; otherwise employees must use request_approval('edit_item', ...).
create or replace function public.remove_stock(p_item_id uuid, p_qty integer)
returns integer
language plpgsql security invoker set search_path = ''
as $$
declare
  v_qty integer;
begin
  if p_qty is null or p_qty <= 0 or p_qty > 100000 then
    raise exception 'INVALID_QUANTITY' using errcode = '22023';
  end if;
  update public.items set quantity = quantity - p_qty
  where id = p_item_id and quantity >= p_qty
  returning quantity into v_qty;
  if v_qty is null then
    if exists (select 1 from public.items where id = p_item_id) then
      raise exception 'OUT_OF_STOCK' using errcode = 'P0001';
    end if;
    raise exception 'ITEM_NOT_FOUND' using errcode = 'P0002';
  end if;
  return v_qty;
end $$;

revoke execute on function public.remove_stock(uuid, integer) from public, anon;
grant execute on function public.remove_stock(uuid, integer) to authenticated;
