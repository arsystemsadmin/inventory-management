-- RLS and business-rule tests. Run with: npx supabase test db
-- Self-contained: builds two tenants inside a transaction and rolls back.
begin;
create extension if not exists pgtap with schema extensions;
select plan(60);

-- ---------------------------------------------------------------------------
-- Impersonation helpers (temp schema, gone after the session)
-- ---------------------------------------------------------------------------
create function pg_temp.login_as(p_uid uuid) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims',
           json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
$$;
create function pg_temp.login_anon() returns void language sql as $$
  select set_config('role', 'anon', true),
         set_config('request.jwt.claims', '{"role":"anon"}', true);
$$;
create function pg_temp.logout() returns void language sql as $$
  select set_config('role', 'postgres', true),
         set_config('request.jwt.claims', '', true);
$$;
create function pg_temp.mk_user(p_id uuid, p_email text, p_app jsonb, p_user jsonb)
returns void language sql as $$
  insert into auth.users (instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  values ('00000000-0000-0000-0000-000000000000', p_id, 'authenticated', 'authenticated',
    p_email, '', now(), p_app, p_user, now(), now());
$$;

-- ---------------------------------------------------------------------------
-- Fixture (as superuser)
--   Business A: owner OA, employees EA1 (store A1, locked), EA2 (store A2, setup)
--   Business B: owner OB, employee EB (store B1)
-- ---------------------------------------------------------------------------
-- Public signup path: no app_metadata -> trigger creates business + owner.
select pg_temp.mk_user('a0000000-0000-0000-0000-0000000000a0', 'oa@test.dev',
  '{}', '{"full_name":"Owner A","business_name":"Biz A"}');
select pg_temp.mk_user('b0000000-0000-0000-0000-0000000000b0', 'ob@test.dev',
  '{}', '{"full_name":"Owner B","business_name":"Biz B"}');

create temp table ids as
select
  (select business_id from public.profiles where id = 'a0000000-0000-0000-0000-0000000000a0') as biz_a,
  (select business_id from public.profiles where id = 'b0000000-0000-0000-0000-0000000000b0') as biz_b;
grant select on ids to authenticated, anon;

-- Server-side employee creation path: app_metadata carries business_id.
select pg_temp.mk_user('a0000000-0000-0000-0000-0000000000a1', 'ea1@test.dev',
  jsonb_build_object('business_id', (select biz_a from ids)), '{"full_name":"Emp A1"}');
select pg_temp.mk_user('a0000000-0000-0000-0000-0000000000a2', 'ea2@test.dev',
  jsonb_build_object('business_id', (select biz_a from ids)), '{"full_name":"Emp A2"}');
select pg_temp.mk_user('b0000000-0000-0000-0000-0000000000b1', 'eb@test.dev',
  jsonb_build_object('business_id', (select biz_b from ids)), '{"full_name":"Emp B"}');
-- A signup that *tries* to claim a business via user_metadata must not join it.
select pg_temp.mk_user('c0000000-0000-0000-0000-0000000000c0', 'sneaky@test.dev',
  '{}', jsonb_build_object('full_name', 'Sneaky', 'business_id', (select biz_a from ids), 'role', 'owner'));

insert into public.stores (id, business_id, name, type, starts_at, ends_at, status, inventory_locked_at)
select 'a1000000-0000-0000-0000-000000000001'::uuid, biz_a, 'A1 Flea', 'popup', now() - interval '1 day', now() + interval '2 day', 'active', now() from ids
union all
select 'a2000000-0000-0000-0000-000000000002'::uuid, biz_a, 'A2 Shop', 'permanent', null, null, 'active', null from ids
union all
select 'b1000000-0000-0000-0000-000000000001'::uuid, biz_b, 'B1 Shop', 'permanent', null, null, 'active', null from ids;

insert into public.store_members (store_id, profile_id, business_id)
select 'a1000000-0000-0000-0000-000000000001'::uuid, 'a0000000-0000-0000-0000-0000000000a1'::uuid, biz_a from ids
union all
select 'a2000000-0000-0000-0000-000000000002'::uuid, 'a0000000-0000-0000-0000-0000000000a2'::uuid, biz_a from ids
union all
select 'b1000000-0000-0000-0000-000000000001'::uuid, 'b0000000-0000-0000-0000-0000000000b1'::uuid, biz_b from ids;

insert into public.employee_pay (profile_id, business_id, hourly_rate_cents)
select 'a0000000-0000-0000-0000-0000000000a1'::uuid, biz_a, 1800 from ids
union all
select 'a0000000-0000-0000-0000-0000000000a2'::uuid, biz_a, 2000 from ids
union all
select 'b0000000-0000-0000-0000-0000000000b1'::uuid, biz_b, 2500 from ids;

insert into public.items (id, store_id, name, size, color, price_cents, quantity, low_stock_threshold) values
  ('11000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', 'Last Tee', 'M', 'Black', 2500, 1, 4),
  ('11000000-0000-0000-0000-000000000002', 'a1000000-0000-0000-0000-000000000001', 'Hoodie',   'L', 'Grey',  6000, 10, 4),
  ('12000000-0000-0000-0000-000000000001', 'a2000000-0000-0000-0000-000000000002', 'Cap',      null, 'Red', 1500, 5, 2),
  ('1b000000-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000001', 'B Scarf',  null, 'Blue', 3000, 5, 2);

-- ---------------------------------------------------------------------------
-- Signup trigger
-- ---------------------------------------------------------------------------
select is((select role from public.profiles where id = 'a0000000-0000-0000-0000-0000000000a0'),
  'owner', 'signup creates an owner profile');
select is((select name from public.businesses where id = (select biz_a from ids)),
  'Biz A', 'signup creates the business');
select is((select role from public.profiles where id = 'a0000000-0000-0000-0000-0000000000a1'),
  'employee', 'server-created user becomes employee of given business');
select isnt((select business_id from public.profiles where id = 'c0000000-0000-0000-0000-0000000000c0'),
  (select biz_a from ids), 'user_metadata cannot be used to join another business');
select is((select count(*) from public.profiles where id = 'c0000000-0000-0000-0000-0000000000c0'),
  0::bigint, '...and a signup without business_name gets no profile at all');

-- Supabase Auth admin.createUser(): INSERT without app_metadata, then UPDATE adds it.
select pg_temp.mk_user('d0000000-0000-0000-0000-0000000000d0', 'late@test.dev', '{"provider":"email"}', '{"full_name":"Late Meta"}');
select is((select count(*) from public.profiles where id = 'd0000000-0000-0000-0000-0000000000d0'),
  0::bigint, 'admin-created user has no profile before app_metadata is written');
update auth.users set raw_app_meta_data = raw_app_meta_data || jsonb_build_object('business_id', (select biz_a from ids), 'role', 'employee')
  where id = 'd0000000-0000-0000-0000-0000000000d0';
select results_eq($$select business_id, role from public.profiles where id = 'd0000000-0000-0000-0000-0000000000d0'$$,
  $$select biz_a, 'employee'::text from ids$$, 'app_metadata update creates the employee profile in that business');
select is((select count(*) from public.businesses where name like 'Late Meta%'), 0::bigint,
  'no stray business is created for the employee');

-- ---------------------------------------------------------------------------
-- Employee EA1 (member of A1 only; A1 inventory is locked)
-- ---------------------------------------------------------------------------
select pg_temp.login_as('a0000000-0000-0000-0000-0000000000a1');

select results_eq($$select id from public.stores$$,
  $$values ('a1000000-0000-0000-0000-000000000001'::uuid)$$,
  'employee sees only their assigned store');
select is((select count(*) from public.items where store_id = 'a2000000-0000-0000-0000-000000000002'),
  0::bigint, 'employee cannot read items of an unassigned store');
select is((select count(*) from public.businesses), 1::bigint, 'employee sees only own business');
select is((select count(*) from public.businesses where id = (select biz_b from ids)),
  0::bigint, 'employee cannot read another business');
select is((select count(*) from public.items where business_id = (select biz_b from ids)),
  0::bigint, 'employee cannot read another business''s items');
select is((select count(*) from public.profiles where business_id = (select biz_b from ids)),
  0::bigint, 'employee cannot read another business''s profiles');
select results_eq($$select profile_id, hourly_rate_cents from public.employee_pay$$,
  $$values ('a0000000-0000-0000-0000-0000000000a1'::uuid, 1800)$$,
  'employee sees only their own pay rate');
with u as (update public.employee_pay set hourly_rate_cents = 99999 returning 1) select is(count(*), 0::bigint, 'employee cannot change any pay rate') from u;
select throws_ok($$insert into public.employee_pay (profile_id, business_id, hourly_rate_cents)
  values ('a0000000-0000-0000-0000-0000000000a1', (select biz_a from ids), 1)$$,
  '42501', null, 'employee cannot insert pay rows');
with u as (update public.profiles set active = false
           where id = 'a0000000-0000-0000-0000-0000000000a1' returning 1) select is(count(*), 0::bigint, 'employee cannot update profiles') from u;
with u as (update public.profiles set role = 'owner' where id = auth.uid() returning 1)
select is(count(*), 0::bigint, 'employee cannot promote themselves (0 rows updated)') from u;
select is((select role from public.profiles where id = auth.uid()), 'employee', '...and is still an employee');
with u as (update public.stores set inventory_locked_at = null returning 1) select is(count(*), 0::bigint, 'employee cannot unlock store setup') from u;

-- Selling
select throws_ok($$select public.sell_item('11000000-0000-0000-0000-000000000001', 2)$$,
  'P0001', 'OUT_OF_STOCK', 'sell_item rejects overselling');
select throws_ok($$select public.sell_item('11000000-0000-0000-0000-000000000001', 0)$$,
  '22023', 'INVALID_QUANTITY', 'sell_item rejects zero quantity');
select is((public.sell_item('11000000-0000-0000-0000-000000000001', 1)) ->> 'status_after',
  'OUT', 'selling the last unit succeeds and reports OUT');
select is((select quantity from public.items where id = '11000000-0000-0000-0000-000000000001'),
  0, 'quantity decremented');
select is((select count(*) from public.sales where item_id = '11000000-0000-0000-0000-000000000001'
           and size = 'M' and color = 'Black' and item_name = 'Last Tee'),
  1::bigint, 'sale row recorded with name/size/color snapshot');
select is((select count(*) from public.inventory_movements
           where item_id = '11000000-0000-0000-0000-000000000001' and reason = 'sale' and delta = -1
             and sale_id is not null and actor_id = auth.uid()),
  1::bigint, 'sale logged in inventory_movements');
select throws_ok($$select public.sell_item('11000000-0000-0000-0000-000000000001', 1)$$,
  'P0001', 'OUT_OF_STOCK', 'selling when already out of stock fails');
select throws_ok($$select public.sell_item('12000000-0000-0000-0000-000000000001', 1)$$,
  '42501', 'NOT_STORE_MEMBER', 'cannot sell in an unassigned store');
select throws_ok($$select public.sell_item('1b000000-0000-0000-0000-000000000001', 1)$$,
  'P0002', 'ITEM_NOT_FOUND', 'cannot sell another business''s item');
select throws_ok($$insert into public.sales (business_id, store_id, item_id, sold_by, item_name, quantity, unit_price_cents, total_cents)
  values ((select biz_a from ids), 'a1000000-0000-0000-0000-000000000001', '11000000-0000-0000-0000-000000000002', auth.uid(), 'x', 1, 0, 0)$$,
  '42501', null, 'cannot insert sales directly');
select throws_ok($$insert into public.inventory_movements (business_id, store_id, item_id, delta, quantity_after, reason)
  values ((select biz_a from ids), 'a1000000-0000-0000-0000-000000000001', '11000000-0000-0000-0000-000000000002', 5, 15, 'restock')$$,
  '42501', null, 'cannot forge inventory movements');
select throws_ok($$select public.void_sale((select id from public.sales limit 1))$$,
  '42501', 'OWNER_ONLY', 'employee cannot void a sale');

-- Locked-store editing rules
select lives_ok($$update public.items set quantity = quantity + 5 where id = '11000000-0000-0000-0000-000000000002'$$,
  'employee can add stock after setup is locked');
select throws_ok($$update public.items set quantity = quantity - 1 where id = '11000000-0000-0000-0000-000000000002'$$,
  '42501', 'STOCK_REMOVAL_REQUIRES_APPROVAL', 'employee cannot remove stock after setup');
select throws_ok($$update public.items set price_cents = 1 where id = '11000000-0000-0000-0000-000000000002'$$,
  '42501', 'EDIT_REQUIRES_APPROVAL', 'employee cannot edit item details after setup');
select throws_ok($$update public.items set archived = true where id = '11000000-0000-0000-0000-000000000002'$$,
  '42501', 'ARCHIVE_REQUIRES_APPROVAL', 'employee cannot archive an item');
select lives_ok($$insert into public.items (store_id, name, size, color, price_cents, quantity)
  values ('a1000000-0000-0000-0000-000000000001', 'New Arrival', 'S', 'White', 2000, 3)$$,
  'employee can add new items to their store after setup');
select throws_ok($$insert into public.items (store_id, name, quantity)
  values ('a2000000-0000-0000-0000-000000000002', 'Sneaky', 1)$$,
  '42501', null, 'employee cannot add items to an unassigned store');
select throws_ok($$insert into public.items (store_id, name, quantity)
  values ('b1000000-0000-0000-0000-000000000001', 'Sneaky', 1)$$,
  '42501', null, 'employee cannot add items to another business');

-- Approvals
select isnt(public.request_approval('void_sale',
  (select id from public.sales where item_id = '11000000-0000-0000-0000-000000000001'), 'customer returned'),
  null, 'employee can request a void');
select isnt(public.request_approval('edit_item', '11000000-0000-0000-0000-000000000002',
  'price typo', '{"price_cents": 5500, "quantity_delta": -2}'), null, 'employee can request an edit');
select throws_ok($$select public.request_approval('edit_item', '11000000-0000-0000-0000-000000000002', null, '{"store_id": "x"}')$$,
  '22023', 'INVALID_CHANGE_FIELD', 'edit requests cannot touch protected fields');
select throws_ok($$select public.decide_approval((select id from public.approval_requests limit 1), true)$$,
  '42501', 'OWNER_ONLY', 'employee cannot approve requests');

-- Clock in/out and own pay
select lives_ok($$select public.clock_in('a1000000-0000-0000-0000-000000000001')$$, 'employee can clock in');
select throws_ok($$select public.clock_in('a1000000-0000-0000-0000-000000000001')$$,
  'P0001', 'ALREADY_CLOCKED_IN', 'cannot clock in twice');
select is((select hourly_rate_cents_snapshot from public.time_entries where clock_out is null),
  1800, 'shift snapshots the employee''s rate and they can see it');
select throws_ok($$select public.clock_in('a2000000-0000-0000-0000-000000000002')$$,
  '42501', 'NOT_STORE_MEMBER', 'cannot clock in at an unassigned store');
select throws_ok($$insert into public.time_entries (business_id, store_id, profile_id, hourly_rate_cents_snapshot)
  values ((select biz_a from ids), 'a1000000-0000-0000-0000-000000000001', auth.uid(), 99999)$$,
  '42501', null, 'employee cannot write time entries directly');

-- ---------------------------------------------------------------------------
-- Employee EA2 (store A2 still in setup mode): may edit freely
-- ---------------------------------------------------------------------------
select pg_temp.login_as('a0000000-0000-0000-0000-0000000000a2');
select lives_ok($$update public.items set price_cents = 1800, quantity = 3 where id = '12000000-0000-0000-0000-000000000001'$$,
  'during setup an employee can edit price and reduce stock');
select is((select count(*) from public.time_entries), 0::bigint, 'employee cannot see other employees'' shifts');

-- ---------------------------------------------------------------------------
-- Owner A
-- ---------------------------------------------------------------------------
select pg_temp.login_as('a0000000-0000-0000-0000-0000000000a0');
select is((select count(*) from public.stores), 2::bigint, 'owner sees all stores in their business only');
select is((select count(*) from public.employee_pay), 2::bigint, 'owner sees all pay rates in their business');
select lives_ok($$select public.decide_approval(id, true, 'ok') from public.approval_requests where kind = 'void_sale'$$,
  'owner approves the void');
select is((select quantity from public.items where id = '11000000-0000-0000-0000-000000000001'),
  1, 'approved void restored stock');
select lives_ok($$select public.decide_approval(id, true) from public.approval_requests where kind = 'edit_item'$$,
  'owner approves the edit');
select results_eq($$select price_cents, quantity from public.items where id = '11000000-0000-0000-0000-000000000002'$$,
  $$values (5500, 13)$$, 'approved edit applied price and stock removal');

-- ---------------------------------------------------------------------------
-- Owner B can't see A; deactivated employees and anon see nothing
-- ---------------------------------------------------------------------------
select pg_temp.login_as('b0000000-0000-0000-0000-0000000000b0');
select is((select count(*) from public.items where business_id = (select biz_a from ids)),
  0::bigint, 'another owner cannot read business A items');

select pg_temp.logout();
update public.profiles set active = false where id = 'a0000000-0000-0000-0000-0000000000a2';
select pg_temp.login_as('a0000000-0000-0000-0000-0000000000a2');
select is((select count(*) from public.stores), 0::bigint, 'deactivated employee sees nothing');

select pg_temp.login_anon();
select throws_ok($$select * from public.items$$, '42501', null, 'anon has no table access');

select pg_temp.logout();
select * from finish();
rollback;
