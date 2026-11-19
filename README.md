# Binventory: multitenant inventory for pop-up stores

A proof of concept for businesses that run pop-up stores (flea markets, events) alongside permanent shops.
Owners manage stores, staff, pay and approvals. Employees work from their phones: they set up a pop-up's
inventory, sell with a couple of taps, and clock in and out.

**Stack:** Next.js 15 (App Router) · React 19 · TypeScript · Tailwind v4 · shadcn/ui · Supabase (Postgres, Auth, RLS, Realtime) · `@supabase/ssr` · Zod

---

## Quick start (local Supabase)

Requirements: Node 20+, Docker (running), npm.

```bash
npm install
npx supabase start            # starts Postgres, Auth, REST and Realtime in Docker
npx supabase db reset         # applies supabase/migrations/* and supabase/seed.sql
cp .env.example .env.local    # then fill in the keys printed by `npx supabase status`
npm run dev                   # http://localhost:3000
```

`.env.local` for local dev (`npx supabase status -o env` prints these values):

| Variable | Where it's used | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | browser + server | `http://127.0.0.1:54321` locally |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | browser + server | `ANON_KEY` (or the publishable key). Safe to expose: RLS protects data. |
| `SUPABASE_SERVICE_ROLE_KEY` | **server only** | `SERVICE_ROLE_KEY`. Used only to create, ban and unban employee auth users (`src/lib/supabase/admin.ts`, guarded by `server-only`). Never prefix with `NEXT_PUBLIC_`. |

### Seed logins

All passwords are `password123`.

| Email | Role | Stores |
|---|---|---|
| `owner@popup.test` | Owner (Olivia Owner) | all |
| `maya@popup.test` | Employee (Maya Santos, ₪48/h now; older shifts keep ₪45) | Main Street Shop, Riverside Flea Market |
| `leo@popup.test` | Employee (Leo Park, ₪45/h) | Riverside Flea Market, Winter Night Market |

The seed contains 1 business, 3 stores (1 permanent, 1 active pop-up, 1 upcoming pop-up still in *setup mode*),
31 item variants (several LOW, CRITICAL or OUT), about 20 sales over the last 6 days (one already voided),
2 pending approval requests, and shifts. Maya is clocked in now, and Leo "forgot" to clock out yesterday, so the
payroll page shows a flagged open shift.

### Hosted Supabase instead

1. Create a project at supabase.com, then `npx supabase link --project-ref <ref>`.
2. `npx supabase db push` applies the migrations. Seeding is optional: `psql "$DB_URL" -f supabase/seed.sql`.
3. Set the three env vars from *Project Settings → API*.
4. In *Auth → URL configuration*, set the site URL to your app's URL. If email confirmation is enabled, sign-up shows
   "check your email" and the confirmation link signs the user in.
5. Realtime: the migrations add the tables to the `supabase_realtime` publication. Nothing else to configure.

---

## Deploy to Cloudflare (binventory.arsystems.dev)

The app runs on **Cloudflare Workers** via the OpenNext adapter (`@opennextjs/cloudflare`), which is Cloudflare's
recommended way to host Next.js. It's managed under *Workers & Pages* in the dashboard. `wrangler.jsonc` already
routes the custom domain `binventory.arsystems.dev`; Cloudflare creates its DNS record and certificate on the first
deploy, because `arsystems.dev` is in the same account.

**From GitHub (recommended):**

1. Cloudflare dashboard → *Workers & Pages* → *Create* → *Import a repository* → pick `arsystemsadmin/inventory-management`.
2. Build command: `npx opennextjs-cloudflare build`. Deploy command: `npx opennextjs-cloudflare deploy`.
   The Worker name must match `binventory` from `wrangler.jsonc`.
3. Variables:
   - **Build** variables (inlined into the browser bundle): `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
   - **Runtime secret** (*Settings → Variables and Secrets*, type *Secret*): `SUPABASE_SERVICE_ROLE_KEY`.

**From your machine:** `npx wrangler login`, then `npm run cf:deploy`. Run `npm run cf:preview` to test the Worker
locally first.

**Demo mode (no database yet):** if the Supabase variables aren't set, the whole app runs in the browser instead.
Sign-up, sign-in and every feature work, with the same rules and permissions as the database version. Data is
saved in that browser's local storage, so it survives refreshes but isn't shared across browsers or devices.

- Sign-up offers to load sample data: 3 stores, about 30 items, 2 employees (password `password123`), and a week
  of sales and shifts.
- Each tab keeps its own sign-in. Open the owner in one tab and an employee in another to watch sales arrive live.
- The sign-in page lists the accounts saved in that browser.

Once the Supabase variables are set and the site is redeployed, the app uses the real database automatically.
Demo data is not migrated.

---

## Tests

```bash
npm run test:db            # pgTAP: 60 RLS and business-rule assertions (npx supabase test db)
npm run test:concurrency   # two employees race for the last unit, plus a 12-way burst
npm test                   # both
```

`supabase/tests/database/rls.test.sql` builds two tenants inside a rolled-back transaction and signs in as each user
(it sets `role` and `request.jwt.claims` exactly as PostgREST does). It covers:

- Employees can't read another business, an unassigned store, or anyone else's pay. They can read their own pay.
- Employees can't change pay, profiles or roles (no self-promotion), and can't unlock a store's setup.
- `sell_item` rejects overselling and zero quantities, records the name/size/color snapshot, and writes the movement.
- Selling in an unassigned store or another tenant fails.
- Direct inserts into `sales` or `inventory_movements` are rejected.
- Setup lock: after *Finish setup*, employees can add stock and new items. Editing details, removing stock and
  archiving are blocked unless the owner approves.
- The approval workflow works end to end. Approving a void restores stock; approving an edit applies it.
- Deactivated users see nothing, and `anon` has no table access.
- Sign-up can't join an existing business via `user_metadata`. Employee creation works with Supabase Auth's real
  insert-then-update order.

`scripts/test-concurrency.ts` uses separate Postgres connections. In the first scenario, seller A holds the row lock,
seller B blocks, A commits, and B gets `OUT_OF_STOCK`. In the second, 12 parallel sales of 1 unit against 5 in stock
give exactly 5 successes, 7 `OUT_OF_STOCK`, a final quantity of 0, and 5 movement rows.

---

## How it works

### Data model (`supabase/migrations`)

| Table | Purpose |
|---|---|
| `businesses` | Tenant (includes `timezone` for "today" and "this week") |
| `profiles` | 1:1 with `auth.users`: `business_id`, `role` (`owner` or `employee`), `active` |
| `employee_pay` | Hourly rate, in its own table so RLS can scope it separately (RLS is row-level, not column-level) |
| `stores` | `popup` or `permanent`, dates, status, `inventory_locked_at` (NULL means setup mode) |
| `store_members` | Employee ↔ store assignments |
| `items` | One row per sellable **variant** (name + size + color) with its own quantity, low-stock threshold and optional photo (`image_path`, Storage bucket `item-images`) |
| `sales` | Created only by `sell_item()`. Snapshots `item_name`, `size` and `color`. Voided, never deleted. |
| `inventory_movements` | Append-only audit of every quantity change (initial, restock, edit, sale, void), written by trigger |
| `time_entries` | Shifts with `hourly_rate_cents_snapshot` copied at clock-in, so rate changes never rewrite past pay |
| `approval_requests` | Employee requests (`archive_item`, `edit_item`, `void_sale`) that the owner approves or rejects |

Money is stored as integer agorot (1/100 shekel) everywhere and shown in ₪. Cross-table references use **composite foreign keys that include
`business_id`**, so the schema itself makes cross-tenant links impossible, independent of RLS.

**Changes from the original plan, and why:**

- Employees can see their own rate and earnings, so the snapshot stays on `time_entries`. Employees can read only
  their own shifts and can't write any.
- Items are variants (size and color) because clothing stock is tracked per size and color. Sales copy those fields
  so history stays readable after edits.
- The setup lock and `approval_requests` implement "set everything up once, then changes need approval".

### Security

- RLS is enabled on every table. The `security definer` helpers `current_business_id()`, `is_owner()`,
  `is_store_member(store_id)`, `can_access_store()` and `shares_store_with()` pin `search_path` and return nothing
  for deactivated users.
- Every policy scopes by `business_id`. Employee policies also require store membership.
- Writes that need elevated rights are `security definer` functions that re-check tenant, role and membership:
  `sell_item`, `void_sale`, `request_approval`, `decide_approval`, `finish_store_setup`, `clock_in`, `clock_out`.
  Clients have no insert/update/delete grants on `sales`, `inventory_movements` or `approval_requests`.
- The setup-lock rules live in a trigger on `items`, so they hold no matter which code path writes.
- **Race safety:** `sell_item` takes `SELECT … FOR UPDATE` on the item row. A concurrent seller waits, then re-reads
  the committed quantity and gets `OUT_OF_STOCK`. A `CHECK (quantity >= 0)` backstops it.
- **Sign-up:** a trigger on `auth.users` creates the business and owner profile in the same transaction as the user.
  Employees are created by an owner-only server action that calls `auth.admin.createUser` with `business_id` in
  `app_metadata`, which only the service role can write. Their profile is created when that metadata lands.
  Deactivating an employee sets `active = false`, which RLS uses to hide everything, and bans the user in Supabase
  Auth.
- The middleware validates the session with `auth.getUser()` on every request. Each page also checks the role on
  the server.

### Live updates

`src/components/live-refresh.tsx` subscribes to Supabase Realtime (`postgres_changes`) for `sales`, `items`,
`time_entries`, `approval_requests` and `stores`, and re-renders the page's server components when something changes.
Realtime applies RLS per subscriber, so people only receive events for rows they can read.

- Owners get a "New sale" toast on the dashboard, sales and store pages when staff sell.
- Running pay (employee clock page, owner dashboard, payroll) is recomputed on the server and refreshed every
  **30 minutes**, plus immediately on clock in/out and when the phone wakes up.

### Stock alerts

The rules are OUT (0), CRITICAL (≤ half the threshold), LOW (≤ threshold) and OK. The `stock_status()` SQL function
and the `items_with_status` view feed:

- colored badges on every row
- status filter chips
- a "need restocking" banner on inventory pages
- the dashboard alerts panel
- a warning toast when a sale pushes an item into a worse status

### Pages

| Route | Who | |
|---|---|---|
| `/` | public | Landing page (product overview, same style as other AR Systems sites) |
| `/app` | both | Sends owners to the dashboard and employees to their stores |
| `/signup`, `/login` | public | Sign-up creates the business and owner (in demo mode: in browser storage) |
| `/dashboard` | owner | Sales today and this week per store, on-shift staff with accrued pay, wages this week, stock alerts, approvals, live sales feed |
| `/stores`, `/stores/[id]` | both (scoped) | Store info, today's numbers, setup banner / *Finish setup*, inventory, latest sales. Owner: edit, staff, reopen setup |
| `/inventory` | both (scoped) | Search; filter by store, category and stock status; add/edit; one-tap **Sell** with variant chips and a quantity stepper |
| `/sales` | both (scoped) | History. Owner voids directly; employee requests a void |
| `/approvals` | both | Owner approves or rejects with a before → after diff. Employees see their own requests |
| `/employees` | owner | Create (with temporary password), edit rate, assign stores, deactivate or reactivate |
| `/clock` | both | Clock in/out, own rate, earnings this shift and this week |
| `/payroll` | owner | Date range; hours, rate and amount owed per employee from snapshot rates; open shifts flagged; add, edit or delete shifts |

Every employee screen is built for phones: a bottom tab bar, bottom-sheet dialogs, 44px+ tap targets, and 16px
inputs so iOS doesn't zoom.

### Out of scope, with hooks left in place

- **Barcode scanning:** `items.sku` is indexed per store.
- **Offline mode:** all writes go through small idempotent-ish actions and RPCs.
- **POS and card payments:** `sales` keeps unit price and total snapshots.
- **Multiple owners or a manager role:** drop the `profiles_one_owner_per_business` index and extend `role`.
- **Stock transfers:** add a `transfer` movement reason. Store ids are immutable on items by design.
- **Exports:** all reporting is plain SQL (`sales_summary`, `payroll_report`).
