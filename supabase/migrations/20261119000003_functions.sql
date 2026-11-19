-- =============================================================================
-- Business logic functions. All writes that need to bypass RLS are
-- SECURITY DEFINER and re-check tenant, role and membership explicitly.
-- Errors use stable uppercase codes in the message so the UI can map them.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Signup: one trigger on auth.users.
--  * raw_app_meta_data.business_id present  -> user created server-side by an
--    owner (service role). app_metadata can't be set by end users.
--  * otherwise -> public signup: create a business + owner profile.
-- -----------------------------------------------------------------------------
create or replace function private.handle_new_user()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  v_business_id uuid := nullif(new.raw_app_meta_data ->> 'business_id', '')::uuid;
  v_role        text := coalesce(new.raw_app_meta_data ->> 'role', 'employee');
  v_full_name   text := coalesce(
                          nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
                          nullif(trim(new.raw_app_meta_data ->> 'full_name'), ''),
                          split_part(new.email, '@', 1));
  v_biz_name    text := nullif(trim(new.raw_user_meta_data ->> 'business_name'), '');
begin
  if v_business_id is null then
    insert into public.businesses (name)
    values (coalesce(v_biz_name, v_full_name || '''s business'))
    returning id into v_business_id;
    v_role := 'owner';
  end if;

  insert into public.profiles (id, business_id, full_name, email, role)
  values (new.id, v_business_id, v_full_name, coalesce(new.email, ''), v_role);
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

-- -----------------------------------------------------------------------------
-- sell_item: atomic, race-safe sale.
-- SELECT ... FOR UPDATE serialises concurrent sellers on the item row; under
-- READ COMMITTED the second waiter re-reads the committed quantity, so if the
-- first took the last unit the second sees 0 and gets OUT_OF_STOCK.
-- -----------------------------------------------------------------------------
create or replace function public.sell_item(p_item_id uuid, p_qty integer)
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
begin
  if v_uid is null or public.current_business_id() is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = '42501';
  end if;
  if p_qty is null or p_qty <= 0 or p_qty > 10000 then
    raise exception 'INVALID_QUANTITY' using errcode = '22023';
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

  v_before := public.stock_status(v_item.quantity, v_item.low_stock_threshold);

  insert into public.sales
    (business_id, store_id, item_id, sold_by, item_name, size, color,
     quantity, unit_price_cents, total_cents)
  values
    (v_item.business_id, v_item.store_id, v_item.id, v_uid, v_item.name,
     v_item.size, v_item.color, p_qty, v_item.price_cents, p_qty * v_item.price_cents)
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
    'total_cents', p_qty * v_item.price_cents,
    'quantity_after', v_item.quantity - p_qty,
    'status_before', v_before,
    'status_after', v_after
  );
end $$;

-- -----------------------------------------------------------------------------
-- Internal actions shared by owner direct calls and approval decisions.
-- -----------------------------------------------------------------------------
create or replace function private.do_void_sale(p_sale_id uuid)
returns void language plpgsql security definer set search_path = ''
as $$
declare
  v_sale public.sales%rowtype;
begin
  select * into v_sale from public.sales where id = p_sale_id for update;
  if not found or v_sale.business_id <> public.current_business_id() then
    raise exception 'SALE_NOT_FOUND' using errcode = 'P0002';
  end if;
  if v_sale.voided_at is not null then
    raise exception 'SALE_ALREADY_VOIDED' using errcode = 'P0001';
  end if;

  update public.sales set voided_at = now(), voided_by = auth.uid() where id = p_sale_id;

  perform set_config('app.movement_reason', 'void', true);
  perform set_config('app.movement_sale_id', p_sale_id::text, true);
  update public.items set quantity = quantity + v_sale.quantity where id = v_sale.item_id;
  perform set_config('app.movement_reason', '', true);
  perform set_config('app.movement_sale_id', '', true);
end $$;

create or replace function private.do_edit_item(p_item_id uuid, p_changes jsonb)
returns void language plpgsql security definer set search_path = ''
as $$
declare
  v_item  public.items%rowtype;
  v_delta integer := coalesce((p_changes ->> 'quantity_delta')::integer, 0);
begin
  select * into v_item from public.items where id = p_item_id for update;
  if not found or v_item.business_id <> public.current_business_id() then
    raise exception 'ITEM_NOT_FOUND' using errcode = 'P0002';
  end if;
  if v_item.quantity + v_delta < 0 then
    raise exception 'OUT_OF_STOCK'
      using errcode = 'P0001',
            detail = format('Cannot remove %s, only %s left', -v_delta, v_item.quantity);
  end if;

  update public.items set
    name                = coalesce(p_changes ->> 'name', name),
    sku                 = case when p_changes ? 'sku' then p_changes ->> 'sku' else sku end,
    category            = case when p_changes ? 'category' then p_changes ->> 'category' else category end,
    size                = case when p_changes ? 'size' then p_changes ->> 'size' else size end,
    color               = case when p_changes ? 'color' then p_changes ->> 'color' else color end,
    price_cents         = coalesce((p_changes ->> 'price_cents')::integer, price_cents),
    cost_cents          = coalesce((p_changes ->> 'cost_cents')::integer, cost_cents),
    low_stock_threshold = coalesce((p_changes ->> 'low_stock_threshold')::integer, low_stock_threshold),
    quantity            = quantity + v_delta
  where id = p_item_id;
end $$;

-- Owner: void a sale directly (restores stock, logs a 'void' movement).
create or replace function public.void_sale(p_sale_id uuid)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if not public.is_owner() then
    raise exception 'OWNER_ONLY' using errcode = '42501';
  end if;
  perform private.do_void_sale(p_sale_id);
end $$;

-- -----------------------------------------------------------------------------
-- Approval workflow
-- -----------------------------------------------------------------------------
create or replace function public.request_approval(
  p_kind text, p_target_id uuid, p_reason text default null, p_changes jsonb default null)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_store_id uuid;
  v_id       uuid;
  v_voided   timestamptz;
  v_allowed  text[] := array['name','sku','category','size','color','price_cents',
                             'cost_cents','low_stock_threshold','quantity_delta'];
  v_key      text;
begin
  if public.current_business_id() is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = '42501';
  end if;

  if p_kind in ('archive_item', 'edit_item') then
    select store_id into v_store_id from public.items
      where id = p_target_id and business_id = public.current_business_id();
  elsif p_kind = 'void_sale' then
    select store_id, voided_at into v_store_id, v_voided from public.sales
      where id = p_target_id and business_id = public.current_business_id();
    if v_voided is not null then
      raise exception 'SALE_ALREADY_VOIDED' using errcode = 'P0001';
    end if;
  else
    raise exception 'INVALID_REQUEST_KIND' using errcode = '22023';
  end if;

  if v_store_id is null or not public.can_access_store(v_store_id) then
    raise exception 'NOT_FOUND' using errcode = 'P0002';
  end if;

  if p_kind = 'edit_item' then
    if p_changes is null or jsonb_typeof(p_changes) <> 'object' or p_changes = '{}'::jsonb then
      raise exception 'NO_CHANGES' using errcode = '22023';
    end if;
    for v_key in select jsonb_object_keys(p_changes) loop
      if not v_key = any (v_allowed) then
        raise exception 'INVALID_CHANGE_FIELD' using errcode = '22023', detail = v_key;
      end if;
    end loop;
  end if;

  insert into public.approval_requests
    (business_id, store_id, kind, item_id, sale_id, reason, changes, requested_by)
  values
    (public.current_business_id(), v_store_id, p_kind,
     case when p_kind <> 'void_sale' then p_target_id end,
     case when p_kind = 'void_sale' then p_target_id end,
     nullif(trim(p_reason), ''),
     case when p_kind = 'edit_item' then p_changes end,
     auth.uid())
  returning id into v_id;
  return v_id;
exception
  when unique_violation then
    raise exception 'REQUEST_ALREADY_PENDING' using errcode = 'P0001';
end $$;

create or replace function public.decide_approval(
  p_request_id uuid, p_approve boolean, p_note text default null)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_req public.approval_requests%rowtype;
begin
  if not public.is_owner() then
    raise exception 'OWNER_ONLY' using errcode = '42501';
  end if;

  select * into v_req from public.approval_requests where id = p_request_id for update;
  if not found or v_req.business_id <> public.current_business_id() then
    raise exception 'NOT_FOUND' using errcode = 'P0002';
  end if;
  if v_req.status <> 'pending' then
    raise exception 'ALREADY_DECIDED' using errcode = 'P0001';
  end if;

  if p_approve then
    if v_req.kind = 'void_sale' then
      perform private.do_void_sale(v_req.sale_id);
    elsif v_req.kind = 'archive_item' then
      update public.items set archived = true where id = v_req.item_id;
    elsif v_req.kind = 'edit_item' then
      perform private.do_edit_item(v_req.item_id, v_req.changes);
    end if;
  end if;

  update public.approval_requests
  set status = case when p_approve then 'approved' else 'rejected' end,
      decided_by = auth.uid(),
      decided_at = now(),
      decision_note = nullif(trim(p_note), '')
  where id = p_request_id;
end $$;

-- -----------------------------------------------------------------------------
-- Setup lock: any member (or the owner) can finish setup; only the owner can
-- reopen it (via a normal stores update, which RLS restricts to owners).
-- -----------------------------------------------------------------------------
create or replace function public.finish_store_setup(p_store_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not public.can_access_store(p_store_id) then
    raise exception 'NOT_FOUND' using errcode = 'P0002';
  end if;
  update public.stores
  set inventory_locked_at = now(), inventory_locked_by = auth.uid()
  where id = p_store_id and inventory_locked_at is null;
end $$;

-- -----------------------------------------------------------------------------
-- Clock in / out. Definer so the rate can be snapshotted from employee_pay.
-- -----------------------------------------------------------------------------
create or replace function public.clock_in(p_store_id uuid)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_store public.stores%rowtype;
  v_id    uuid;
begin
  if not public.can_access_store(p_store_id) then
    raise exception 'NOT_STORE_MEMBER' using errcode = '42501';
  end if;
  select * into v_store from public.stores where id = p_store_id;
  if v_store.status = 'closed' then
    raise exception 'STORE_CLOSED' using errcode = 'P0001';
  end if;

  insert into public.time_entries (business_id, store_id, profile_id, clock_in, hourly_rate_cents_snapshot)
  values (
    v_store.business_id, p_store_id, auth.uid(), now(),
    coalesce((select hourly_rate_cents from public.employee_pay where profile_id = auth.uid()), 0)
  )
  returning id into v_id;
  return v_id;
exception
  when unique_violation then
    raise exception 'ALREADY_CLOCKED_IN' using errcode = 'P0001';
end $$;

create or replace function public.clock_out()
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_id uuid;
begin
  update public.time_entries
  set clock_out = now()
  where profile_id = auth.uid() and clock_out is null
    and business_id = public.current_business_id()
  returning id into v_id;
  if v_id is null then
    raise exception 'NOT_CLOCKED_IN' using errcode = 'P0001';
  end if;
  return v_id;
end $$;

-- -----------------------------------------------------------------------------
-- Reporting (SECURITY INVOKER: callers' RLS decides what is counted).
-- -----------------------------------------------------------------------------

-- Non-voided sales today and this week (business timezone), per visible store.
create or replace function public.sales_summary()
returns table (
  store_id uuid, store_name text, store_type text, store_status text,
  today_cents bigint, today_units bigint, today_count bigint,
  week_cents bigint, week_units bigint, week_count bigint)
language sql stable security invoker set search_path = ''
as $$
  with tz as (
    select b.timezone as tz from public.businesses b where b.id = public.current_business_id()
  ), bounds as (
    select
      (date_trunc('day',  now() at time zone tz.tz)) at time zone tz.tz as day_start,
      (date_trunc('week', now() at time zone tz.tz)) at time zone tz.tz as week_start
    from tz
  )
  select
    s.id, s.name, s.type, s.status,
    coalesce(sum(sa.total_cents) filter (where sa.created_at >= b.day_start), 0)::bigint,
    coalesce(sum(sa.quantity)    filter (where sa.created_at >= b.day_start), 0)::bigint,
    count(sa.id)                 filter (where sa.created_at >= b.day_start),
    coalesce(sum(sa.total_cents), 0)::bigint,
    coalesce(sum(sa.quantity), 0)::bigint,
    count(sa.id)
  from public.stores s
  cross join bounds b
  left join public.sales sa
    on sa.store_id = s.id and sa.voided_at is null and sa.created_at >= b.week_start
  group by s.id, s.name, s.type, s.status
  order by s.name
$$;

-- Payroll for a period. Shifts are attributed by clock_in; open shifts accrue
-- up to now() and are counted in open_shifts so the UI can flag them.
create or replace function public.payroll_report(p_from timestamptz, p_to timestamptz)
returns table (
  profile_id uuid, full_name text, active boolean,
  current_rate_cents integer, shifts bigint, open_shifts bigint,
  worked_minutes bigint, amount_cents bigint)
language sql stable security invoker set search_path = ''
as $$
  select
    p.id, p.full_name, p.active,
    ep.hourly_rate_cents,
    count(te.id),
    count(te.id) filter (where te.is_open),
    coalesce(sum(te.worked_minutes), 0)::bigint,
    coalesce(sum(te.amount_cents), 0)::bigint
  from public.profiles p
  left join public.employee_pay ep on ep.profile_id = p.id
  left join public.time_entries_with_pay te
    on te.profile_id = p.id and te.clock_in >= p_from and te.clock_in < p_to
  where p.business_id = public.current_business_id()
  group by p.id, p.full_name, p.active, ep.hourly_rate_cents
  having count(te.id) > 0 or p.active
  order by p.full_name
$$;

-- =============================================================================
-- Privileges: nothing for anon; functions callable by signed-in users only.
-- =============================================================================
revoke all on all tables in schema public from anon;
revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated;
revoke execute on all functions in schema private from public, anon, authenticated;

alter default privileges in schema public revoke execute on functions from public, anon;

-- Writes to these tables only happen through SECURITY DEFINER functions/triggers.
revoke insert, update, delete on public.sales, public.inventory_movements,
  public.approval_requests from authenticated;
revoke insert, delete on public.profiles from authenticated;
revoke delete on public.items, public.businesses from authenticated;
revoke insert on public.businesses from authenticated;

-- =============================================================================
-- Realtime: stream changes (RLS-filtered per subscriber) for live screens.
-- =============================================================================
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table
      public.sales, public.items, public.time_entries, public.approval_requests, public.stores;
  end if;
end $$;
