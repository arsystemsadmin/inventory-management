-- Multi-item sales ("cart"): several variations sold in one checkout, all or
-- nothing. Each line is still its own row in sales (so stock, voids and
-- reports work as before), tied together by cart_id.
alter table public.sales add column if not exists cart_id uuid;
create index if not exists sales_cart_idx on public.sales (cart_id) where cart_id is not null;

-- p_lines: [{"item_id": uuid, "quantity": int}, ...] (max 50 lines).
-- One payment for the whole cart. For a split, the cash part is spread over
-- the lines in order: lines fully paid in cash are 'cash', at most one line is
-- 'split', the rest are 'credit' - so every row still adds up on its own.
create or replace function public.sell_cart(
  p_lines jsonb, p_payment_method text default 'cash', p_cash_cents integer default null)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_cart  uuid := gen_random_uuid();
  v_line  record;
  v_price integer;
  v_total bigint := 0;
  v_left  bigint;
  v_lt    integer;
  v_res   jsonb;
  v_out   jsonb := '[]'::jsonb;
begin
  if auth.uid() is null or public.current_business_id() is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = '42501';
  end if;
  if p_payment_method is null or p_payment_method not in ('cash', 'credit', 'split') then
    raise exception 'INVALID_PAYMENT' using errcode = '22023';
  end if;
  if p_lines is null or jsonb_typeof(p_lines) <> 'array'
     or jsonb_array_length(p_lines) = 0 or jsonb_array_length(p_lines) > 50 then
    raise exception 'INVALID_QUANTITY' using errcode = '22023';
  end if;

  -- Lock every row first (in a fixed order, so two carts can't deadlock) and
  -- work out the total. sell_item re-checks access, stock and store per line.
  for v_line in
    select (e->>'item_id')::uuid as item_id, sum((e->>'quantity')::integer) as qty
    from jsonb_array_elements(p_lines) e group by 1 order by 1
  loop
    select price_cents into v_price from public.items
     where id = v_line.item_id and business_id = public.current_business_id() for update;
    if not found then
      raise exception 'ITEM_NOT_FOUND' using errcode = 'P0002';
    end if;
    v_total := v_total + coalesce(v_line.qty, 0) * v_price;
  end loop;

  if p_payment_method = 'split' and (p_cash_cents is null or p_cash_cents <= 0 or p_cash_cents >= v_total) then
    raise exception 'INVALID_PAYMENT' using errcode = '22023';
  end if;
  v_left := case p_payment_method when 'cash' then v_total when 'credit' then 0 else p_cash_cents end;

  for v_line in
    select (e->>'item_id')::uuid as item_id, sum((e->>'quantity')::integer) as qty
    from jsonb_array_elements(p_lines) e group by 1 order by 1
  loop
    select price_cents into v_price from public.items where id = v_line.item_id;
    v_lt := coalesce(v_line.qty, 0) * v_price;
    if p_payment_method <> 'split' then
      v_res := public.sell_item(v_line.item_id, v_line.qty, p_payment_method, null);
    elsif v_left >= v_lt then
      v_res := public.sell_item(v_line.item_id, v_line.qty, 'cash', null);
      v_left := v_left - v_lt;
    elsif v_left > 0 then
      v_res := public.sell_item(v_line.item_id, v_line.qty, 'split', v_left::integer);
      v_left := 0;
    else
      v_res := public.sell_item(v_line.item_id, v_line.qty, 'credit', null);
    end if;
    update public.sales set cart_id = v_cart where id = (v_res->>'sale_id')::uuid;
    v_out := v_out || jsonb_build_array(v_res);
  end loop;

  return jsonb_build_object('cart_id', v_cart, 'total_cents', v_total, 'lines', v_out);
end $$;

revoke execute on function public.sell_cart(jsonb, text, integer) from public, anon;
grant execute on function public.sell_cart(jsonb, text, integer) to authenticated;
