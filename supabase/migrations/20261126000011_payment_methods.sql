-- Payment method per sale: cash, credit, or split (part cash, part credit).
-- cash_cents + credit_cents always equals total_cents.

alter table public.sales
  add column payment_method text not null default 'cash' check (payment_method in ('cash', 'credit', 'split')),
  add column cash_cents integer not null default 0 check (cash_cents >= 0),
  add column credit_cents integer not null default 0 check (credit_cents >= 0);

-- Existing sales were all treated as cash.
update public.sales set cash_cents = total_cents, credit_cents = 0, payment_method = 'cash';

alter table public.sales add constraint payment_adds_up check (
  cash_cents + credit_cents = total_cents
  and (payment_method <> 'cash' or credit_cents = 0)
  and (payment_method <> 'credit' or cash_cents = 0)
  and (payment_method <> 'split' or (cash_cents > 0 and credit_cents > 0))
);

-- sell_item gains the payment details (defaults keep old 2-argument calls working as cash).
drop function if exists public.sell_item(uuid, integer);

create or replace function public.sell_item(
  p_item_id uuid, p_qty integer, p_payment_method text default 'cash', p_cash_cents integer default null)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid     uuid := auth.uid();
  v_item    public.items%rowtype;
  v_store   public.stores%rowtype;
  v_sale_id uuid;
  v_before  text;
  v_after   text;
  v_total   integer;
  v_cash    integer;
  v_credit  integer;
begin
  if v_uid is null or public.current_business_id() is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = '42501';
  end if;
  if p_qty is null or p_qty <= 0 or p_qty > 10000 then
    raise exception 'INVALID_QUANTITY' using errcode = '22023';
  end if;
  if p_payment_method is null or p_payment_method not in ('cash', 'credit', 'split') then
    raise exception 'INVALID_PAYMENT' using errcode = '22023';
  end if;

  select * into v_item from public.items where id = p_item_id for update;

  -- Same error for "doesn't exist" and "other tenant" so IDs can't be probed.
  if not found or v_item.business_id <> public.current_business_id() then
    raise exception 'ITEM_NOT_FOUND' using errcode = 'P0002';
  end if;
  if not (public.is_owner() or public.is_store_member(v_item.store_id)) then
    raise exception 'NOT_STORE_MEMBER' using errcode = '42501';
  end if;
  if v_item.archived then
    raise exception 'ITEM_ARCHIVED' using errcode = 'P0001';
  end if;

  select * into v_store from public.stores where id = v_item.store_id;
  if v_store.status = 'closed' then
    raise exception 'STORE_CLOSED' using errcode = 'P0001';
  end if;

  if v_item.quantity < p_qty then
    raise exception 'OUT_OF_STOCK'
      using errcode = 'P0001',
            detail = format('Requested %s, only %s left', p_qty, v_item.quantity);
  end if;

  v_total := p_qty * v_item.price_cents;
  if p_payment_method = 'cash' then
    v_cash := v_total; v_credit := 0;
  elsif p_payment_method = 'credit' then
    v_cash := 0; v_credit := v_total;
  else
    -- Split: the cash part is given, credit is the rest; both must be > 0.
    if p_cash_cents is null or p_cash_cents <= 0 or p_cash_cents >= v_total then
      raise exception 'INVALID_PAYMENT' using errcode = '22023';
    end if;
    v_cash := p_cash_cents; v_credit := v_total - p_cash_cents;
  end if;

  v_before := public.stock_status(v_item.quantity, v_item.low_stock_threshold);

  insert into public.sales
    (business_id, store_id, item_id, sold_by, item_name, size, color,
     quantity, unit_price_cents, total_cents, payment_method, cash_cents, credit_cents)
  values
    (v_item.business_id, v_item.store_id, v_item.id, v_uid, v_item.name,
     v_item.size, v_item.color, p_qty, v_item.price_cents, v_total, p_payment_method, v_cash, v_credit)
  returning id into v_sale_id;

  perform set_config('app.movement_reason', 'sale', true);
  perform set_config('app.movement_sale_id', v_sale_id::text, true);
  update public.items set quantity = quantity - p_qty where id = v_item.id;
  perform set_config('app.movement_reason', '', true);
  perform set_config('app.movement_sale_id', '', true);

  v_after := public.stock_status(v_item.quantity - p_qty, v_item.low_stock_threshold);

  return jsonb_build_object(
    'sale_id', v_sale_id,
    'item_id', v_item.id,
    'item_name', v_item.name,
    'size', v_item.size,
    'color', v_item.color,
    'quantity_sold', p_qty,
    'total_cents', v_total,
    'payment_method', p_payment_method,
    'cash_cents', v_cash,
    'credit_cents', v_credit,
    'quantity_after', v_item.quantity - p_qty,
    'status_before', v_before,
    'status_after', v_after
  );
end $$;

revoke execute on function public.sell_item(uuid, integer, text, integer) from public, anon;
grant execute on function public.sell_item(uuid, integer, text, integer) to authenticated;
