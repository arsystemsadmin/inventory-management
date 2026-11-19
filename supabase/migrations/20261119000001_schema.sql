-- =============================================================================
-- Core schema for the multitenant pop-up inventory app.
--
-- Tenant isolation rules enforced by the schema itself (independent of RLS):
--   * Every tenant-owned row carries business_id.
--   * Cross-table references use composite foreign keys that include
--     business_id, so a row can never link to another tenant's data even if
--     an application bug tried to.
--   * Money is integer cents.
-- =============================================================================

create extension if not exists pgcrypto with schema extensions;

-- Private schema for internal functions that must not be callable via the API.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- businesses (tenants)
-- -----------------------------------------------------------------------------
create table public.businesses (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (length(trim(name)) between 1 and 200),
  -- Used for "today" / "this week" boundaries on the dashboard.
  timezone    text not null default 'America/New_York',
  created_at  timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- profiles (one per auth user)
-- -----------------------------------------------------------------------------
create table public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  business_id  uuid not null references public.businesses (id) on delete cascade,
  full_name    text not null check (length(trim(full_name)) between 1 and 200),
  email        text not null,
  role         text not null check (role in ('owner', 'employee')),
  active       boolean not null default true,
  created_at   timestamptz not null default now(),
  unique (id, business_id)
);
-- Exactly one owner per business for now (multiple owners/managers are future work;
-- dropping this index is all it takes to allow them).
create unique index profiles_one_owner_per_business
  on public.profiles (business_id) where role = 'owner';
create index profiles_business_idx on public.profiles (business_id);

-- -----------------------------------------------------------------------------
-- employee_pay: kept out of profiles so RLS can restrict it independently.
-- Owner: read/write all in business. Employee: read own row only.
-- -----------------------------------------------------------------------------
create table public.employee_pay (
  profile_id         uuid primary key,
  business_id        uuid not null,
  hourly_rate_cents  integer not null check (hourly_rate_cents >= 0),
  updated_at         timestamptz not null default now(),
  foreign key (profile_id, business_id)
    references public.profiles (id, business_id) on delete cascade
);

-- -----------------------------------------------------------------------------
-- stores
-- -----------------------------------------------------------------------------
create table public.stores (
  id           uuid primary key default gen_random_uuid(),
  business_id  uuid not null references public.businesses (id) on delete cascade,
  name         text not null check (length(trim(name)) between 1 and 200),
  type         text not null check (type in ('popup', 'permanent')),
  address      text,
  starts_at    timestamptz,
  ends_at      timestamptz,
  status       text not null default 'active'
               check (status in ('upcoming', 'active', 'closed')),
  -- NULL = setup/onboarding mode: members may add and edit items freely.
  -- Once set, employees may only add items/stock and sell; edits, stock
  -- removal and archiving need owner approval.
  inventory_locked_at  timestamptz,
  inventory_locked_by  uuid,
  created_at   timestamptz not null default now(),
  unique (id, business_id),
  constraint popup_needs_dates check (
    type = 'permanent'
    or (starts_at is not null and ends_at is not null and ends_at > starts_at)
  )
);
create index stores_business_idx on public.stores (business_id);

-- -----------------------------------------------------------------------------
-- store_members: which employees work at which store.
-- -----------------------------------------------------------------------------
create table public.store_members (
  store_id     uuid not null,
  profile_id   uuid not null,
  business_id  uuid not null,
  created_at   timestamptz not null default now(),
  primary key (store_id, profile_id),
  foreign key (store_id, business_id)
    references public.stores (id, business_id) on delete cascade,
  foreign key (profile_id, business_id)
    references public.profiles (id, business_id) on delete cascade
);
create index store_members_profile_idx on public.store_members (profile_id);

-- -----------------------------------------------------------------------------
-- items: each item belongs to exactly one store.
-- -----------------------------------------------------------------------------
create table public.items (
  id                   uuid primary key default gen_random_uuid(),
  business_id          uuid not null,
  store_id             uuid not null,
  name                 text not null check (length(trim(name)) between 1 and 200),
  sku                  text check (sku is null or length(sku) <= 64),
  category             text check (category is null or length(category) <= 100),
  -- Each row is one sellable variant (e.g. "Linen shirt", size M, color Navy).
  size                 text check (size is null or length(size) <= 40),
  color                text check (color is null or length(color) <= 40),
  price_cents          integer not null default 0 check (price_cents >= 0),
  cost_cents           integer not null default 0 check (cost_cents >= 0),
  quantity             integer not null default 0 check (quantity >= 0),
  low_stock_threshold  integer not null default 5 check (low_stock_threshold >= 0),
  archived             boolean not null default false,
  created_by           uuid references public.profiles (id) on delete set null,
  updated_by           uuid references public.profiles (id) on delete set null,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  unique (id, business_id),
  unique (id, store_id, business_id),
  foreign key (store_id, business_id)
    references public.stores (id, business_id) on delete restrict
);
create index items_store_idx on public.items (store_id) where not archived;
create unique index items_store_sku_unique
  on public.items (store_id, lower(sku)) where sku is not null and not archived;

-- -----------------------------------------------------------------------------
-- sales: inserted only by sell_item(); voided only by owner paths.
-- -----------------------------------------------------------------------------
create table public.sales (
  id                uuid primary key default gen_random_uuid(),
  business_id       uuid not null,
  store_id          uuid not null,
  item_id           uuid not null,
  sold_by           uuid not null,
  -- Snapshot of what was sold, so history survives later item edits.
  item_name         text not null,
  size              text,
  color             text,
  quantity          integer not null check (quantity > 0),
  unit_price_cents  integer not null check (unit_price_cents >= 0),
  total_cents       integer not null check (total_cents >= 0),
  created_at        timestamptz not null default now(),
  voided_at         timestamptz,
  voided_by         uuid references public.profiles (id) on delete set null,
  constraint total_matches check (total_cents = quantity * unit_price_cents),
  foreign key (item_id, store_id, business_id)
    references public.items (id, store_id, business_id) on delete restrict,
  foreign key (sold_by, business_id)
    references public.profiles (id, business_id) on delete restrict
);
create index sales_store_created_idx on public.sales (store_id, created_at desc);
create index sales_business_created_idx on public.sales (business_id, created_at desc);
create index sales_item_idx on public.sales (item_id);

-- -----------------------------------------------------------------------------
-- inventory_movements: append-only audit of every quantity change.
-- Written exclusively by the items trigger (no client insert policy).
-- -----------------------------------------------------------------------------
create table public.inventory_movements (
  id              uuid primary key default gen_random_uuid(),
  business_id     uuid not null,
  store_id        uuid not null,
  item_id         uuid not null,
  delta           integer not null,
  quantity_after  integer not null,
  reason          text not null
                  check (reason in ('initial', 'restock', 'edit', 'sale', 'void')),
  sale_id         uuid references public.sales (id) on delete set null,
  actor_id        uuid references public.profiles (id) on delete set null,
  created_at      timestamptz not null default now(),
  foreign key (item_id, store_id, business_id)
    references public.items (id, store_id, business_id) on delete cascade
);
create index inventory_movements_item_idx on public.inventory_movements (item_id, created_at desc);
create index inventory_movements_store_idx on public.inventory_movements (store_id, created_at desc);

-- -----------------------------------------------------------------------------
-- time_entries: rate is snapshotted at clock-in so later rate changes never
-- rewrite past pay. Employees may read their own rows (including the
-- snapshot) but can only create/close them through clock_in()/clock_out().
-- -----------------------------------------------------------------------------
create table public.time_entries (
  id                           uuid primary key default gen_random_uuid(),
  business_id                  uuid not null,
  store_id                     uuid not null,
  profile_id                   uuid not null,
  clock_in                     timestamptz not null default now(),
  clock_out                    timestamptz,
  hourly_rate_cents_snapshot   integer not null check (hourly_rate_cents_snapshot >= 0),
  note                         text check (note is null or length(note) <= 500),
  edited_by                    uuid references public.profiles (id) on delete set null,
  created_at                   timestamptz not null default now(),
  updated_at                   timestamptz not null default now(),
  constraint clock_out_after_in check (clock_out is null or clock_out > clock_in),
  foreign key (store_id, business_id)
    references public.stores (id, business_id) on delete restrict,
  foreign key (profile_id, business_id)
    references public.profiles (id, business_id) on delete cascade
);
-- At most one open shift per person.
create unique index time_entries_one_open_shift
  on public.time_entries (profile_id) where clock_out is null;
create index time_entries_business_clock_in_idx on public.time_entries (business_id, clock_in);
create index time_entries_profile_idx on public.time_entries (profile_id, clock_in desc);

-- -----------------------------------------------------------------------------
-- approval_requests: employees can't archive items or void sales themselves;
-- they file a request that the owner approves or rejects.
-- -----------------------------------------------------------------------------
create table public.approval_requests (
  id              uuid primary key default gen_random_uuid(),
  business_id     uuid not null,
  store_id        uuid not null,
  kind            text not null check (kind in ('archive_item', 'void_sale', 'edit_item')),
  item_id         uuid,
  sale_id         uuid references public.sales (id) on delete cascade,
  -- For edit_item: proposed new field values, plus optional "quantity_delta"
  -- (negative) to remove stock. Applied verbatim on approval.
  changes         jsonb,
  reason          text check (reason is null or length(reason) <= 500),
  status          text not null default 'pending'
                  check (status in ('pending', 'approved', 'rejected')),
  requested_by    uuid not null,
  requested_at    timestamptz not null default now(),
  decided_by      uuid references public.profiles (id) on delete set null,
  decided_at      timestamptz,
  decision_note   text check (decision_note is null or length(decision_note) <= 500),
  constraint target_matches_kind check (
    (kind = 'archive_item' and item_id is not null and sale_id is null and changes is null)
    or (kind = 'edit_item' and item_id is not null and sale_id is null
        and changes is not null and jsonb_typeof(changes) = 'object')
    or (kind = 'void_sale' and sale_id is not null and changes is null)
  ),
  foreign key (store_id, business_id)
    references public.stores (id, business_id) on delete cascade,
  foreign key (item_id, store_id, business_id)
    references public.items (id, store_id, business_id) on delete cascade,
  foreign key (requested_by, business_id)
    references public.profiles (id, business_id) on delete cascade
);
create unique index approval_one_pending_archive
  on public.approval_requests (item_id) where status = 'pending' and kind = 'archive_item';
create unique index approval_one_pending_edit
  on public.approval_requests (item_id) where status = 'pending' and kind = 'edit_item';
create unique index approval_one_pending_void
  on public.approval_requests (sale_id) where status = 'pending' and kind = 'void_sale';
create index approval_business_status_idx on public.approval_requests (business_id, status, requested_at desc);
