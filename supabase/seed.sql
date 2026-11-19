-- =============================================================================
-- Demo seed. Logins (password for all: password123):
--   owner@popup.test   Olivia Owner   (owner)
--   maya@popup.test    Maya Santos    (employee: Main Street + Riverside Flea)
--   leo@popup.test     Leo Park       (employee: Riverside Flea + Winter Night Market)
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Auth users (the on_auth_user_created trigger creates business + profiles)
-- ---------------------------------------------------------------------------
create function pg_temp.seed_user(p_id uuid, p_email text, p_app jsonb, p_user jsonb)
returns void language sql as $$
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change,
    email_change_token_current, phone_change, phone_change_token, reauthentication_token)
  values (
    '00000000-0000-0000-0000-000000000000', p_id, 'authenticated', 'authenticated', p_email,
    extensions.crypt('password123', extensions.gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb || p_app, p_user, now(), now(),
    '', '', '', '', '', '', '', '');
  insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  values (gen_random_uuid(), p_id, p_id::text,
    jsonb_build_object('sub', p_id::text, 'email', p_email, 'email_verified', true),
    'email', now(), now(), now());
$$;

-- Owner: public-signup path -> creates the business.
select pg_temp.seed_user('00000000-0000-4000-a000-000000000001', 'owner@popup.test', '{}',
  '{"full_name":"Olivia Owner","business_name":"Thread & Co. Pop-ups"}');

create temp table seed_ids as
select business_id as biz from public.profiles where id = '00000000-0000-4000-a000-000000000001';

update public.businesses set timezone = 'America/New_York' where id = (select biz from seed_ids);

-- Employees: server-side path (app_metadata.business_id).
select pg_temp.seed_user('00000000-0000-4000-a000-000000000002', 'maya@popup.test',
  jsonb_build_object('business_id', (select biz from seed_ids)), '{"full_name":"Maya Santos"}');
select pg_temp.seed_user('00000000-0000-4000-a000-000000000003', 'leo@popup.test',
  jsonb_build_object('business_id', (select biz from seed_ids)), '{"full_name":"Leo Park"}');

insert into public.employee_pay (profile_id, business_id, hourly_rate_cents)
select '00000000-0000-4000-a000-000000000002'::uuid, biz, 4500 from seed_ids
union all
select '00000000-0000-4000-a000-000000000003'::uuid, biz, 4500 from seed_ids;

-- ---------------------------------------------------------------------------
-- Stores
-- ---------------------------------------------------------------------------
insert into public.stores (id, business_id, name, type, address, starts_at, ends_at, status, inventory_locked_at)
select '00000000-0000-4000-b000-000000000001'::uuid, biz, 'Main Street Shop', 'permanent',
       '120 Main St, Brooklyn, NY', null::timestamptz, null::timestamptz, 'active', now() - interval '60 days' from seed_ids
union all
select '00000000-0000-4000-b000-000000000002'::uuid, biz, 'Riverside Flea Market', 'popup',
       'Pier 5, Riverside Park', date_trunc('day', now()) - interval '2 days', date_trunc('day', now()) + interval '3 days',
       'active', now() - interval '3 days' from seed_ids
union all
select '00000000-0000-4000-b000-000000000003'::uuid, biz, 'Winter Night Market', 'popup',
       'Union Square Plaza', date_trunc('day', now()) + interval '10 days', date_trunc('day', now()) + interval '24 days',
       'upcoming', null from seed_ids;

insert into public.store_members (store_id, profile_id, business_id)
select s, p, biz from seed_ids, (values
  ('00000000-0000-4000-b000-000000000001'::uuid, '00000000-0000-4000-a000-000000000002'::uuid),
  ('00000000-0000-4000-b000-000000000002'::uuid, '00000000-0000-4000-a000-000000000002'::uuid),
  ('00000000-0000-4000-b000-000000000002'::uuid, '00000000-0000-4000-a000-000000000003'::uuid),
  ('00000000-0000-4000-b000-000000000003'::uuid, '00000000-0000-4000-a000-000000000003'::uuid)
) as m(s, p);

-- ---------------------------------------------------------------------------
-- Items (one row per name/size/color variant). Quantities here are BEFORE the
-- seeded sales below; several are sold down into LOW / CRITICAL / OUT.
-- ---------------------------------------------------------------------------
insert into public.items (store_id, name, sku, category, size, color, price_cents, cost_cents, quantity, low_stock_threshold) values
  -- Main Street Shop
  ('00000000-0000-4000-b000-000000000001', 'Linen Shirt',     'LS-WHT-S', 'Shirts',    'S',  'White', 17400, 6600, 12, 4),
  ('00000000-0000-4000-b000-000000000001', 'Linen Shirt',     'LS-WHT-M', 'Shirts',    'M',  'White', 17400, 6600, 6, 4),
  ('00000000-0000-4000-b000-000000000001', 'Linen Shirt',     'LS-NVY-M', 'Shirts',    'M',  'Navy', 17400, 6600, 4, 4),
  ('00000000-0000-4000-b000-000000000001', 'Linen Shirt',     'LS-NVY-L', 'Shirts',    'L',  'Navy', 17400, 6600, 9, 4),
  ('00000000-0000-4000-b000-000000000001', 'Selvedge Jeans',  'SJ-IND-30','Pants',     '30', 'Indigo', 38400, 15600, 7, 3),
  ('00000000-0000-4000-b000-000000000001', 'Selvedge Jeans',  'SJ-IND-32','Pants',     '32', 'Indigo', 38400, 15600, 2, 3),
  ('00000000-0000-4000-b000-000000000001', 'Selvedge Jeans',  'SJ-IND-34','Pants',     '34', 'Indigo', 38400, 15600, 5, 3),
  ('00000000-0000-4000-b000-000000000001', 'Wool Beanie',     'WB-CHR',   'Accessories','One size','Charcoal', 8400, 2700, 20, 6),
  ('00000000-0000-4000-b000-000000000001', 'Wool Beanie',     'WB-RST',   'Accessories','One size','Rust', 8400, 2700, 1, 6),
  ('00000000-0000-4000-b000-000000000001', 'Canvas Tote',     'CT-NAT',   'Accessories','One size','Natural', 9600, 3300, 15, 5),
  ('00000000-0000-4000-b000-000000000001', 'Leather Belt',    'LB-BRN-M', 'Accessories','M',  'Brown', 14400, 5400, 0, 2),
  ('00000000-0000-4000-b000-000000000001', 'Leather Belt',    'LB-BLK-M', 'Accessories','M',  'Black', 14400, 5400, 6, 2),
  -- Riverside Flea Market
  ('00000000-0000-4000-b000-000000000002', 'Vintage Band Tee','VT-BLK-S', 'T-Shirts',  'S',  'Black', 10500, 2700, 6, 3),
  ('00000000-0000-4000-b000-000000000002', 'Vintage Band Tee','VT-BLK-M', 'T-Shirts',  'M',  'Black', 10500, 2700, 8, 3),
  ('00000000-0000-4000-b000-000000000002', 'Vintage Band Tee','VT-BLK-L', 'T-Shirts',  'L',  'Black', 10500, 2700, 3, 3),
  ('00000000-0000-4000-b000-000000000002', 'Vintage Band Tee','VT-WHT-M', 'T-Shirts',  'M',  'White', 10500, 2700, 10, 3),
  ('00000000-0000-4000-b000-000000000002', 'Denim Jacket',    'DJ-LT-M',  'Outerwear', 'M',  'Light wash', 25500, 9000, 4, 2),
  ('00000000-0000-4000-b000-000000000002', 'Denim Jacket',    'DJ-LT-L',  'Outerwear', 'L',  'Light wash', 25500, 9000, 2, 2),
  ('00000000-0000-4000-b000-000000000002', 'Denim Jacket',    'DJ-DK-M',  'Outerwear', 'M',  'Dark wash', 25500, 9000, 5, 2),
  ('00000000-0000-4000-b000-000000000002', 'Crewneck Sweater','CS-OAT-M', 'Knitwear',  'M',  'Oatmeal', 19200, 7200, 7, 3),
  ('00000000-0000-4000-b000-000000000002', 'Crewneck Sweater','CS-OAT-L', 'Knitwear',  'L',  'Oatmeal', 19200, 7200, 2, 3),
  ('00000000-0000-4000-b000-000000000002', 'Crewneck Sweater','CS-GRN-M', 'Knitwear',  'M',  'Forest', 19200, 7200, 6, 3),
  ('00000000-0000-4000-b000-000000000002', 'Bucket Hat',      'BH-KHK',   'Accessories','One size','Khaki', 7200, 2100, 12, 4),
  ('00000000-0000-4000-b000-000000000002', 'Bucket Hat',      'BH-BLK',   'Accessories','One size','Black', 7200, 2100, 3, 4),
  ('00000000-0000-4000-b000-000000000002', 'Patch Pack',      'PP-MIX',   'Accessories','One size','Mixed', 3600, 900, 25, 8),
  -- Winter Night Market (still in setup mode)
  ('00000000-0000-4000-b000-000000000003', 'Puffer Vest',     'PV-BLK-M', 'Outerwear', 'M',  'Black', 29400, 11400, 8, 3),
  ('00000000-0000-4000-b000-000000000003', 'Puffer Vest',     'PV-BLK-L', 'Outerwear', 'L',  'Black', 29400, 11400, 6, 3),
  ('00000000-0000-4000-b000-000000000003', 'Fleece Pullover', 'FP-CRM-M', 'Outerwear', 'M',  'Cream', 22200, 7800, 5, 3),
  ('00000000-0000-4000-b000-000000000003', 'Fleece Pullover', 'FP-CRM-S', 'Outerwear', 'S',  'Cream', 22200, 7800, 0, 3),
  ('00000000-0000-4000-b000-000000000003', 'Knit Scarf',      'KS-RED',   'Accessories','One size','Red', 10800, 3600, 14, 5),
  ('00000000-0000-4000-b000-000000000003', 'Knit Mittens',    'KM-GRY',   'Accessories','One size','Grey', 7800, 2400, 2, 4);

-- ---------------------------------------------------------------------------
-- Sales: made through sell_item() so stock, sales and movements agree, then
-- back-dated across the last 6 days (several today).
-- ---------------------------------------------------------------------------
create function pg_temp.sell_as(p_uid uuid, p_sku text, p_store uuid, p_qty int, p_ago interval)
returns void language plpgsql as $$
declare
  v_res jsonb;
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
  v_res := public.sell_item((select id from public.items where sku = p_sku and store_id = p_store), p_qty);
  update public.sales set created_at = now() - p_ago where id = (v_res ->> 'sale_id')::uuid;
  update public.inventory_movements set created_at = now() - p_ago where sale_id = (v_res ->> 'sale_id')::uuid;
  perform set_config('request.jwt.claims', '', true);
end $$;

do $$
declare
  maya uuid := '00000000-0000-4000-a000-000000000002';
  leo  uuid := '00000000-0000-4000-a000-000000000003';
  main uuid := '00000000-0000-4000-b000-000000000001';
  flea uuid := '00000000-0000-4000-b000-000000000002';
begin
  -- Main Street, Maya, over the week
  perform pg_temp.sell_as(maya, 'LS-WHT-S',  main, 2, interval '5 days 3 hours');
  perform pg_temp.sell_as(maya, 'SJ-IND-30', main, 1, interval '4 days 5 hours');
  perform pg_temp.sell_as(maya, 'WB-CHR',    main, 3, interval '3 days 2 hours');
  perform pg_temp.sell_as(maya, 'LS-WHT-M',  main, 3, interval '2 days 4 hours');  -- -> LOW
  perform pg_temp.sell_as(maya, 'CT-NAT',    main, 2, interval '1 day 6 hours');
  perform pg_temp.sell_as(maya, 'SJ-IND-32', main, 1, interval '1 day 1 hour');    -- -> CRITICAL
  perform pg_temp.sell_as(maya, 'LS-NVY-L',  main, 1, interval '4 hours');
  perform pg_temp.sell_as(maya, 'LB-BLK-M',  main, 1, interval '2 hours');
  -- Riverside Flea (started 2 days ago), both employees
  perform pg_temp.sell_as(leo,  'VT-BLK-M',  flea, 2, interval '2 days 1 hour');
  perform pg_temp.sell_as(maya, 'DJ-LT-M',   flea, 1, interval '2 days');
  perform pg_temp.sell_as(leo,  'CS-OAT-M',  flea, 2, interval '1 day 5 hours');
  perform pg_temp.sell_as(leo,  'VT-BLK-L',  flea, 3, interval '1 day 3 hours');   -- -> OUT
  perform pg_temp.sell_as(maya, 'PP-MIX',    flea, 5, interval '1 day 2 hours');
  perform pg_temp.sell_as(leo,  'BH-KHK',    flea, 2, interval '5 hours');
  perform pg_temp.sell_as(leo,  'VT-BLK-S',  flea, 2, interval '3 hours');
  perform pg_temp.sell_as(maya, 'DJ-LT-L',   flea, 1, interval '2 hours 30 minutes'); -- -> CRITICAL
  perform pg_temp.sell_as(leo,  'VT-WHT-M',  flea, 1, interval '90 minutes');
  perform pg_temp.sell_as(maya, 'CS-GRN-M',  flea, 1, interval '45 minutes');
  perform pg_temp.sell_as(leo,  'BH-BLK',    flea, 1, interval '20 minutes');      -- -> CRITICAL
  perform pg_temp.sell_as(maya, 'VT-BLK-M',  flea, 1, interval '10 minutes');
end $$;

-- An already-voided sale (customer return), done by the owner.
do $$
declare v_sale uuid;
begin
  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-a000-000000000001","role":"authenticated"}', true);
  v_sale := (public.sell_item((select id from public.items where sku = 'DJ-DK-M'), 1) ->> 'sale_id')::uuid;
  update public.sales set created_at = now() - interval '1 day 4 hours' where id = v_sale;
  perform public.void_sale(v_sale);
  perform set_config('request.jwt.claims', '', true);
end $$;

-- Pending approval requests from employees.
do $$
begin
  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-a000-000000000002","role":"authenticated"}', true);
  perform public.request_approval('void_sale',
    (select id from public.sales where item_id = (select id from public.items where sku = 'CS-GRN-M') limit 1),
    'Customer changed their mind right away');
  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-a000-000000000003","role":"authenticated"}', true);
  perform public.request_approval('edit_item', (select id from public.items where sku = 'PP-MIX'),
    'Price tag says ₪30, not ₪36', '{"price_cents": 3000}'::jsonb);
  perform set_config('request.jwt.claims', '', true);
end $$;

-- ---------------------------------------------------------------------------
-- Time entries (rate snapshotted by trigger from employee_pay).
-- Maya is clocked in now; Leo forgot to clock out yesterday (open shift flag).
-- ---------------------------------------------------------------------------
insert into public.time_entries (business_id, store_id, profile_id, clock_in, clock_out)
select biz, s, p, ci, co from seed_ids, (values
  ('00000000-0000-4000-b000-000000000001'::uuid, '00000000-0000-4000-a000-000000000002'::uuid,
     date_trunc('day', now()) - interval '5 days' + interval '9 hours',  date_trunc('day', now()) - interval '5 days' + interval '17 hours'),
  ('00000000-0000-4000-b000-000000000001'::uuid, '00000000-0000-4000-a000-000000000002'::uuid,
     date_trunc('day', now()) - interval '4 days' + interval '10 hours', date_trunc('day', now()) - interval '4 days' + interval '16 hours 30 minutes'),
  ('00000000-0000-4000-b000-000000000002'::uuid, '00000000-0000-4000-a000-000000000002'::uuid,
     date_trunc('day', now()) - interval '2 days' + interval '8 hours',  date_trunc('day', now()) - interval '2 days' + interval '18 hours'),
  ('00000000-0000-4000-b000-000000000002'::uuid, '00000000-0000-4000-a000-000000000003'::uuid,
     date_trunc('day', now()) - interval '2 days' + interval '8 hours',  date_trunc('day', now()) - interval '2 days' + interval '18 hours 15 minutes'),
  ('00000000-0000-4000-b000-000000000002'::uuid, '00000000-0000-4000-a000-000000000003'::uuid,
     date_trunc('day', now()) - interval '1 day' + interval '8 hours',   null::timestamptz),
  ('00000000-0000-4000-b000-000000000002'::uuid, '00000000-0000-4000-a000-000000000002'::uuid,
     now() - interval '3 hours 10 minutes',                              null::timestamptz)
) as t(s, p, ci, co);

-- Rate changed after older shifts: proves payroll uses snapshots.
update public.employee_pay set hourly_rate_cents = 4800 where profile_id = '00000000-0000-4000-a000-000000000002';
