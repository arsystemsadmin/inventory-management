-- 1) Payment method "other" with its name (e.g. Bit, PayBox, bank transfer).
-- 2) Optional proof-of-payment photo per sale, in a PRIVATE bucket.

alter table public.sales drop constraint if exists payment_adds_up;
alter table public.sales drop constraint if exists sales_payment_method_check;
alter table public.sales add constraint sales_payment_method_check
  check (payment_method in ('cash', 'credit', 'split', 'other'));
alter table public.sales
  add column if not exists other_cents integer not null default 0 check (other_cents >= 0),
  add column if not exists payment_other text check (payment_other is null or length(trim(payment_other)) between 1 and 60),
  add column if not exists proof_path text check (proof_path is null or (length(proof_path) <= 300 and proof_path !~ '^data:'));
alter table public.sales add constraint payment_adds_up check (
  cash_cents + credit_cents + other_cents = total_cents
  and (payment_method <> 'cash'   or (credit_cents = 0 and other_cents = 0))
  and (payment_method <> 'credit' or (cash_cents = 0 and other_cents = 0))
  and (payment_method <> 'split'  or (cash_cents > 0 and credit_cents > 0 and other_cents = 0))
  and (payment_method <> 'other'  or (cash_cents = 0 and credit_cents = 0 and payment_other is not null))
);

-- Private bucket: receipts and transfer screenshots are personal data. Paths:
--   <business_id>/<store_id>/<uuid>.jpg ; read/write only for people with access to that store.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('sale-proofs', 'sale-proofs', false, 4194304, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

drop policy if exists sale_proofs_select on storage.objects;
drop policy if exists sale_proofs_insert on storage.objects;
drop policy if exists sale_proofs_update on storage.objects;
drop policy if exists sale_proofs_delete on storage.objects;
create policy sale_proofs_select on storage.objects for select to authenticated
  using (bucket_id = 'sale-proofs'
    and (storage.foldername(name))[1] = public.current_business_id()::text
    and public.can_access_store(((storage.foldername(name))[2])::uuid));
create policy sale_proofs_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'sale-proofs'
    and (storage.foldername(name))[1] = public.current_business_id()::text
    and public.can_access_store(((storage.foldername(name))[2])::uuid));
create policy sale_proofs_update on storage.objects for update to authenticated
  using (bucket_id = 'sale-proofs'
    and (storage.foldername(name))[1] = public.current_business_id()::text
    and public.can_access_store(((storage.foldername(name))[2])::uuid));
create policy sale_proofs_delete on storage.objects for delete to authenticated
  using (bucket_id = 'sale-proofs'
    and (storage.foldername(name))[1] = public.current_business_id()::text
    and public.can_access_store(((storage.foldername(name))[2])::uuid));

-- sell_item gains the "other" name and the proof. The old 4-argument version
-- is dropped so calls can't be ambiguous (old callers still work: new args default).
drop function if exists public.sell_item(uuid, integer, text, integer);

create or replace function public.sell_item(
  p_item_id uuid, p_qty integer, p_payment_method text default 'cash', p_cash_cents integer default null,
  p_payment_other text default null, p_proof_path text default null)
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
  v_cash    integer := 0;
  v_credit  integer := 0;
  v_other   integer := 0;
  v_name    text := nullif(trim(coalesce(p_payment_other, '')), '');
begin
  if v_uid is null or public.current_business_id() is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = '42501';
  end if;
  if p_qty is null or p_qty <= 0 or p_qty > 10000 then
    raise exception 'INVALID_QUANTITY' using errcode = '22023';
  end if;
  if p_payment_method is null or p_payment_method not in ('cash', 'credit', 'split', 'other')
     or (p_payment_method = 'other' and (v_name is null or length(v_name) > 60)) then
    raise exception 'INVALID_PAYMENT' using errcode = '22023';
  end if;

  select * into v_item from public.items where id = p_item_id for update;
  if not found or v_item.business_id <> public.current_business_id() then
    raise exception 'ITEM_NOT_FOUND' using errcode = 'P0002';
  end if;
  if not (public.is_owner() or public.is_store_member(v_item.store_id)) then
    raise exception 'NOT_STORE_MEMBER' using errcode = '42501';
  end if;
  if v_item.archived then
    raise exception 'ITEM_ARCHIVED' using errcode = 'P0001';
  end if;
  -- A proof must live in this business's folder.
  if p_proof_path is not null and p_proof_path not like v_item.business_id::text || '/%' then
    raise exception 'INVALID_PAYMENT' using errcode = '22023';
  end if;

  select * into v_store from public.stores where id = v_item.store_id;
  if v_store.status = 'closed' then
    raise exception 'STORE_CLOSED' using errcode = 'P0001';
  end if;
  if v_item.quantity < p_qty then
    raise exception 'OUT_OF_STOCK'
      using errcode = 'P0001', detail = format('Requested %s, only %s left', p_qty, v_item.quantity);
  end if;

  v_total := p_qty * v_item.price_cents;
  if p_payment_method = 'cash' then
    v_cash := v_total;
  elsif p_payment_method = 'credit' then
    v_credit := v_total;
  elsif p_payment_method = 'other' then
    v_other := v_total;
  else
    if p_cash_cents is null or p_cash_cents <= 0 or p_cash_cents >= v_total then
      raise exception 'INVALID_PAYMENT' using errcode = '22023';
    end if;
    v_cash := p_cash_cents; v_credit := v_total - p_cash_cents;
  end if;

  v_before := public.stock_status(v_item.quantity, v_item.low_stock_threshold);

  insert into public.sales
    (business_id, store_id, item_id, sold_by, item_name, size, color, quantity, unit_price_cents, total_cents,
     payment_method, cash_cents, credit_cents, other_cents, payment_other, proof_path)
  values
    (v_item.business_id, v_item.store_id, v_item.id, v_uid, v_item.name, v_item.size, v_item.color, p_qty,
     v_item.price_cents, v_total, p_payment_method, v_cash, v_credit, v_other,
     case when p_payment_method = 'other' then v_name end, p_proof_path)
  returning id into v_sale_id;

  perform set_config('app.movement_reason', 'sale', true);
  perform set_config('app.movement_sale_id', v_sale_id::text, true);
  update public.items set quantity = quantity - p_qty where id = v_item.id;
  perform set_config('app.movement_reason', '', true);
  perform set_config('app.movement_sale_id', '', true);

  v_after := public.stock_status(v_item.quantity - p_qty, v_item.low_stock_threshold);

  return jsonb_build_object(
    'sale_id', v_sale_id, 'item_id', v_item.id, 'item_name', v_item.name, 'size', v_item.size, 'color', v_item.color,
    'quantity_sold', p_qty, 'total_cents', v_total, 'payment_method', p_payment_method,
    'cash_cents', v_cash, 'credit_cents', v_credit, 'other_cents', v_other,
    'payment_other', case when p_payment_method = 'other' then v_name end,
    'quantity_after', v_item.quantity - p_qty, 'status_before', v_before, 'status_after', v_after
  );
end $$;

revoke execute on function public.sell_item(uuid, integer, text, integer, text, text) from public, anon;
grant execute on function public.sell_item(uuid, integer, text, integer, text, text) to authenticated;

-- sell_cart: same, one payment (and one proof) for the whole cart.
drop function if exists public.sell_cart(jsonb, text, integer);

create or replace function public.sell_cart(
  p_lines jsonb, p_payment_method text default 'cash', p_cash_cents integer default null,
  p_payment_other text default null, p_proof_path text default null)
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
  if p_payment_method is null or p_payment_method not in ('cash', 'credit', 'split', 'other') then
    raise exception 'INVALID_PAYMENT' using errcode = '22023';
  end if;
  if p_lines is null or jsonb_typeof(p_lines) <> 'array'
     or jsonb_array_length(p_lines) = 0 or jsonb_array_length(p_lines) > 50 then
    raise exception 'INVALID_QUANTITY' using errcode = '22023';
  end if;

  for v_line in
    select (e->>'item_id')::uuid as item_id, sum((e->>'quantity')::integer)::integer as qty
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
  v_left := case p_payment_method when 'cash' then v_total when 'split' then p_cash_cents else 0 end;

  for v_line in
    select (e->>'item_id')::uuid as item_id, sum((e->>'quantity')::integer)::integer as qty
    from jsonb_array_elements(p_lines) e group by 1 order by 1
  loop
    select price_cents into v_price from public.items where id = v_line.item_id;
    v_lt := coalesce(v_line.qty, 0) * v_price;
    if p_payment_method <> 'split' then
      v_res := public.sell_item(v_line.item_id, v_line.qty, p_payment_method, null, p_payment_other, p_proof_path);
    elsif v_left >= v_lt then
      v_res := public.sell_item(v_line.item_id, v_line.qty, 'cash', null, null, p_proof_path);
      v_left := v_left - v_lt;
    elsif v_left > 0 then
      v_res := public.sell_item(v_line.item_id, v_line.qty, 'split', v_left::integer, null, p_proof_path);
      v_left := 0;
    else
      v_res := public.sell_item(v_line.item_id, v_line.qty, 'credit', null, null, p_proof_path);
    end if;
    update public.sales set cart_id = v_cart where id = (v_res->>'sale_id')::uuid;
    v_out := v_out || jsonb_build_array(v_res);
  end loop;

  return jsonb_build_object('cart_id', v_cart, 'total_cents', v_total, 'lines', v_out);
end $$;

revoke execute on function public.sell_cart(jsonb, text, integer, text, text) from public, anon;
grant execute on function public.sell_cart(jsonb, text, integer, text, text) to authenticated;

-- Add, replace or remove the proof after the sale. Anyone who can see the
-- sale's store may do it; a checkout's lines (same cart) share one proof.
create or replace function public.set_sale_proof(p_sale_id uuid, p_proof_path text)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_sale public.sales%rowtype;
begin
  if auth.uid() is null or public.current_business_id() is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = '42501';
  end if;
  select * into v_sale from public.sales where id = p_sale_id;
  if not found or v_sale.business_id <> public.current_business_id() or not public.can_access_store(v_sale.store_id) then
    raise exception 'SALE_NOT_FOUND' using errcode = 'P0002';
  end if;
  if p_proof_path is not null and p_proof_path not like v_sale.business_id::text || '/%' then
    raise exception 'INVALID_PAYMENT' using errcode = '22023';
  end if;
  update public.sales set proof_path = p_proof_path
   where id = p_sale_id or (v_sale.cart_id is not null and cart_id = v_sale.cart_id);
end $$;

revoke execute on function public.set_sale_proof(uuid, text) from public, anon;
grant execute on function public.set_sale_proof(uuid, text) to authenticated;
