-- =============================================================================
-- Security helpers, integrity triggers and row level security.
--
-- Helpers are SECURITY DEFINER so policies can consult profiles/store_members
-- without recursing through those tables' own RLS. Each pins search_path to ''
-- and fully qualifies every object to prevent search_path hijacking.
-- A deactivated profile resolves to NULL business -> sees nothing.
-- =============================================================================

create or replace function public.current_business_id()
returns uuid
language sql stable security definer set search_path = ''
as $$
  select p.business_id
  from public.profiles p
  where p.id = auth.uid() and p.active
$$;

create or replace function public.is_owner()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.active and p.role = 'owner'
  )
$$;

create or replace function public.is_store_member(p_store_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.store_members sm
    join public.profiles p
      on p.id = sm.profile_id and p.business_id = sm.business_id
    where sm.store_id = p_store_id
      and sm.profile_id = auth.uid()
      and p.active
  )
$$;

-- Owner of the store's business, or an active member of the store.
create or replace function public.can_access_store(p_store_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.stores s
    where s.id = p_store_id
      and s.business_id = public.current_business_id()
      and (public.is_owner() or public.is_store_member(s.id))
  )
$$;

-- True if the caller shares at least one store with p_profile_id
-- (lets employees see coworkers' names, e.g. "sold by").
create or replace function public.shares_store_with(p_profile_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.store_members mine
    join public.store_members theirs on theirs.store_id = mine.store_id
    where mine.profile_id = auth.uid()
      and theirs.profile_id = p_profile_id
      and mine.business_id = public.current_business_id()
  )
$$;

-- OUT (0), CRITICAL (<= half threshold), LOW (<= threshold), OK.
create or replace function public.stock_status(p_quantity integer, p_threshold integer)
returns text
language sql immutable
as $$
  select case
    when p_quantity <= 0 then 'OUT'
    when p_quantity <= p_threshold / 2.0 then 'CRITICAL'
    when p_quantity <= p_threshold then 'LOW'
    else 'OK'
  end
$$;

-- =============================================================================
-- Integrity triggers
-- =============================================================================

create or replace function private.touch_updated_at()
returns trigger language plpgsql set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- profiles: identity, tenant and role are immutable from the API;
-- an owner can't deactivate themselves.
create or replace function private.profiles_guard()
returns trigger language plpgsql set search_path = ''
as $$
begin
  if new.id <> old.id or new.business_id <> old.business_id or new.role <> old.role then
    raise exception 'PROFILE_IMMUTABLE_FIELDS' using errcode = '42501';
  end if;
  if old.role = 'owner' and not new.active then
    raise exception 'CANNOT_DEACTIVATE_OWNER' using errcode = '42501';
  end if;
  return new;
end $$;

create trigger profiles_guard before update on public.profiles
  for each row execute function private.profiles_guard();

-- items: fill business_id from the store, stamp actors, and enforce the
-- setup-lock rules for non-owners.
create or replace function private.items_before_write()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  v_store   public.stores%rowtype;
  v_owner   boolean := public.is_owner();
  v_reason  text := nullif(current_setting('app.movement_reason', true), '');
begin
  select * into v_store from public.stores where id = new.store_id;
  if not found then
    raise exception 'STORE_NOT_FOUND' using errcode = 'P0002';
  end if;

  if tg_op = 'INSERT' then
    new.business_id := v_store.business_id;
    new.created_by  := coalesce(auth.uid(), new.created_by);
    new.updated_by  := new.created_by;
    if new.archived and not v_owner and auth.uid() is not null then
      raise exception 'ARCHIVE_REQUIRES_APPROVAL' using errcode = '42501';
    end if;
    return new;
  end if;

  -- UPDATE
  if new.store_id <> old.store_id or new.business_id <> old.business_id then
    raise exception 'ITEM_STORE_IMMUTABLE' using errcode = '42501';
  end if;
  new.updated_by := coalesce(auth.uid(), new.updated_by);
  new.updated_at := now();

  -- Owners (and server-side jobs with no auth context) may do anything.
  if v_owner or auth.uid() is null then
    return new;
  end if;

  if new.archived is distinct from old.archived then
    raise exception 'ARCHIVE_REQUIRES_APPROVAL' using errcode = '42501';
  end if;

  -- Sales (via sell_item) may always decrement.
  if v_reason = 'sale' then
    return new;
  end if;

  if v_store.inventory_locked_at is not null then
    if (new.name, new.sku, new.category, new.size, new.color, new.price_cents,
        new.cost_cents, new.low_stock_threshold)
       is distinct from
       (old.name, old.sku, old.category, old.size, old.color, old.price_cents,
        old.cost_cents, old.low_stock_threshold) then
      raise exception 'EDIT_REQUIRES_APPROVAL' using errcode = '42501';
    end if;
    if new.quantity < old.quantity then
      raise exception 'STOCK_REMOVAL_REQUIRES_APPROVAL' using errcode = '42501';
    end if;
  end if;
  return new;
end $$;

create trigger items_before_write before insert or update on public.items
  for each row execute function private.items_before_write();

-- Every quantity change lands in inventory_movements. The reason/sale id are
-- passed via transaction-local settings by sell_item/void_sale/approvals.
create or replace function private.items_log_movement()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  v_reason text := nullif(current_setting('app.movement_reason', true), '');
  v_sale   uuid := nullif(current_setting('app.movement_sale_id', true), '')::uuid;
  v_delta  integer;
begin
  if tg_op = 'INSERT' then
    v_delta := new.quantity;
    v_reason := 'initial';
  else
    v_delta := new.quantity - old.quantity;
    if v_delta = 0 then
      return null;
    end if;
    v_reason := coalesce(v_reason, case when v_delta > 0 then 'restock' else 'edit' end);
  end if;

  insert into public.inventory_movements
    (business_id, store_id, item_id, delta, quantity_after, reason, sale_id, actor_id)
  values
    (new.business_id, new.store_id, new.id, v_delta, new.quantity, v_reason, v_sale,
     auth.uid());
  return null;
end $$;

create trigger items_log_movement after insert or update of quantity on public.items
  for each row execute function private.items_log_movement();

-- time_entries: snapshot the hourly rate if not given; stamp editor.
create or replace function private.time_entries_before_write()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if tg_op = 'INSERT' and new.hourly_rate_cents_snapshot is null then
    select ep.hourly_rate_cents into new.hourly_rate_cents_snapshot
    from public.employee_pay ep where ep.profile_id = new.profile_id;
    new.hourly_rate_cents_snapshot := coalesce(new.hourly_rate_cents_snapshot, 0);
  end if;
  if tg_op = 'UPDATE' then
    new.updated_at := now();
    new.edited_by := coalesce(auth.uid(), new.edited_by);
  end if;
  return new;
end $$;

create trigger time_entries_before_write before insert or update on public.time_entries
  for each row execute function private.time_entries_before_write();

create trigger employee_pay_touch before update on public.employee_pay
  for each row execute function private.touch_updated_at();

-- =============================================================================
-- Row level security
-- =============================================================================

alter table public.businesses          enable row level security;
alter table public.profiles            enable row level security;
alter table public.employee_pay        enable row level security;
alter table public.stores              enable row level security;
alter table public.store_members       enable row level security;
alter table public.items               enable row level security;
alter table public.sales               enable row level security;
alter table public.inventory_movements enable row level security;
alter table public.time_entries        enable row level security;
alter table public.approval_requests   enable row level security;

-- businesses ---------------------------------------------------------------
create policy businesses_select on public.businesses for select to authenticated
  using (id = public.current_business_id());
create policy businesses_update on public.businesses for update to authenticated
  using (id = public.current_business_id() and public.is_owner())
  with check (id = public.current_business_id());

-- profiles -----------------------------------------------------------------
create policy profiles_select on public.profiles for select to authenticated
  using (
    business_id = public.current_business_id()
    and (public.is_owner() or id = auth.uid() or public.shares_store_with(id))
  );
create policy profiles_update_owner on public.profiles for update to authenticated
  using (business_id = public.current_business_id() and public.is_owner())
  with check (business_id = public.current_business_id());
-- No insert/delete: profiles are created by the auth trigger only.

-- employee_pay: owners manage; employees read their own rate only ----------
create policy employee_pay_select on public.employee_pay for select to authenticated
  using (
    business_id = public.current_business_id()
    and (public.is_owner() or profile_id = auth.uid())
  );
create policy employee_pay_owner_insert on public.employee_pay for insert to authenticated
  with check (business_id = public.current_business_id() and public.is_owner());
create policy employee_pay_owner_update on public.employee_pay for update to authenticated
  using (business_id = public.current_business_id() and public.is_owner())
  with check (business_id = public.current_business_id());
create policy employee_pay_owner_delete on public.employee_pay for delete to authenticated
  using (business_id = public.current_business_id() and public.is_owner());

-- stores -------------------------------------------------------------------
create policy stores_select on public.stores for select to authenticated
  using (
    business_id = public.current_business_id()
    and (public.is_owner() or public.is_store_member(id))
  );
create policy stores_owner_insert on public.stores for insert to authenticated
  with check (business_id = public.current_business_id() and public.is_owner());
create policy stores_owner_update on public.stores for update to authenticated
  using (business_id = public.current_business_id() and public.is_owner())
  with check (business_id = public.current_business_id());
create policy stores_owner_delete on public.stores for delete to authenticated
  using (business_id = public.current_business_id() and public.is_owner());

-- store_members --------------------------------------------------------------
create policy store_members_select on public.store_members for select to authenticated
  using (
    business_id = public.current_business_id()
    and (public.is_owner() or profile_id = auth.uid())
  );
create policy store_members_owner_insert on public.store_members for insert to authenticated
  with check (business_id = public.current_business_id() and public.is_owner());
create policy store_members_owner_delete on public.store_members for delete to authenticated
  using (business_id = public.current_business_id() and public.is_owner());

-- items: owner + store members; no hard delete (archive instead) ------------
create policy items_select on public.items for select to authenticated
  using (
    business_id = public.current_business_id()
    and (public.is_owner() or public.is_store_member(store_id))
  );
create policy items_insert on public.items for insert to authenticated
  with check (
    business_id = public.current_business_id()
    and (public.is_owner() or public.is_store_member(store_id))
  );
create policy items_update on public.items for update to authenticated
  using (
    business_id = public.current_business_id()
    and (public.is_owner() or public.is_store_member(store_id))
  )
  with check (
    business_id = public.current_business_id()
    and (public.is_owner() or public.is_store_member(store_id))
  );

-- sales: read in scope; writes only through functions --------------------
create policy sales_select on public.sales for select to authenticated
  using (
    business_id = public.current_business_id()
    and (public.is_owner() or public.is_store_member(store_id))
  );

-- inventory_movements: read in scope; written only by trigger -------------
create policy inventory_movements_select on public.inventory_movements for select to authenticated
  using (
    business_id = public.current_business_id()
    and (public.is_owner() or public.is_store_member(store_id))
  );

-- time_entries: owner manages all; employee reads own ----------------------
create policy time_entries_select on public.time_entries for select to authenticated
  using (
    business_id = public.current_business_id()
    and (public.is_owner() or profile_id = auth.uid())
  );
create policy time_entries_owner_insert on public.time_entries for insert to authenticated
  with check (business_id = public.current_business_id() and public.is_owner());
create policy time_entries_owner_update on public.time_entries for update to authenticated
  using (business_id = public.current_business_id() and public.is_owner())
  with check (business_id = public.current_business_id());
create policy time_entries_owner_delete on public.time_entries for delete to authenticated
  using (business_id = public.current_business_id() and public.is_owner());

-- approval_requests: owner sees all; requester sees own; writes via functions
create policy approval_requests_select on public.approval_requests for select to authenticated
  using (
    business_id = public.current_business_id()
    and (public.is_owner() or requested_by = auth.uid())
  );

-- =============================================================================
-- Views (security_invoker => the caller's RLS applies)
-- =============================================================================

create view public.items_with_status
with (security_invoker = true) as
select i.*, public.stock_status(i.quantity, i.low_stock_threshold) as stock_status
from public.items i;

-- Live pay: open shifts accrue up to now().
create view public.time_entries_with_pay
with (security_invoker = true) as
select
  te.*,
  (te.clock_out is null) as is_open,
  extract(epoch from (coalesce(te.clock_out, now()) - te.clock_in))::bigint / 60 as worked_minutes,
  round(
    extract(epoch from (coalesce(te.clock_out, now()) - te.clock_in)) / 3600.0
    * te.hourly_rate_cents_snapshot
  )::bigint as amount_cents
from public.time_entries te;
