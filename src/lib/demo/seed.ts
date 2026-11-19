"use client";

import { addStock, clockIn, createItem, requestApproval, sellItem, setSetupLocked, voidSale } from "./logic";
import { newId, type DemoState, type DemoStore } from "./store";

/** Unique sample-employee email within this browser (several demo businesses can exist). */
function uniqueEmail(s: DemoState, local: string) {
  for (let n = 1; ; n++) {
    const email = `${local}${n === 1 ? "" : n}@demo.binventory`;
    if (!s.users.some((u) => u.email === email)) return email;
  }
}

const DAY = 86_400_000;
const iso = (msAgo: number) => new Date(Date.now() - msAgo).toISOString();

/**
 * Mirrors supabase/seed.sql: 3 stores (one still in setup mode), two employees,
 * ~30 clothing variants with some LOW/CRITICAL/OUT, a week of sales, shifts and
 * pending approvals. Returns the sample logins.
 */
export function seedSampleData(s: DemoState, ownerId: string, employeePasswordHash: string) {
  const owner = s.users.find((u) => u.id === ownerId)!;
  const biz = owner.business_id;
  const today = new Date(); today.setUTCHours(0, 0, 0, 0);
  const dayIso = (offset: number, end = false) =>
    new Date(today.getTime() + offset * DAY + (end ? DAY - 1000 : 0)).toISOString();

  const mkStore = (name: string, type: DemoStore["type"], address: string, starts: number | null, ends: number | null,
    status: DemoStore["status"]): DemoStore => {
    const st: DemoStore = {
      id: newId(), business_id: biz, name, type, address, status,
      starts_at: starts === null ? null : dayIso(starts), ends_at: ends === null ? null : dayIso(ends, true),
      inventory_locked_at: null, inventory_locked_by: null, created_at: iso(60 * DAY),
    };
    s.stores.push(st);
    return st;
  };
  const main = mkStore("Main Street Shop", "permanent", "120 Main St", null, null, "active");
  const flea = mkStore("Riverside Flea Market", "popup", "Pier 5, Riverside Park", -2, 3, "active");
  const winter = mkStore("Winter Night Market", "popup", "Union Square Plaza", 10, 24, "upcoming");

  const mkEmployee = (name: string, local: string, rate: number, stores: DemoStore[]) => {
    const email = uniqueEmail(s, local);
    const id = newId();
    s.users.push({ id, business_id: biz, full_name: name, email, role: "employee", active: true,
      password_hash: employeePasswordHash, created_at: iso(30 * DAY) });
    s.pay.push({ profile_id: id, business_id: biz, hourly_rate_cents: rate, updated_at: iso(30 * DAY) });
    stores.forEach((st) => s.members.push({ store_id: st.id, profile_id: id, business_id: biz }));
    return { id, email };
  };
  const maya = mkEmployee("Maya Santos", "maya", 1800, [main, flea]);
  const leo = mkEmployee("Leo Park", "leo", 1650, [flea, winter]);

  type Row = [string, string, string, string, string | null, string, number, number, number, number];
  const rows: [DemoStore, Row[]][] = [
    [main, [
      ["Linen Shirt", "LS-WHT-S", "Shirts", "S", "White", "", 5800, 2200, 12, 4],
      ["Linen Shirt", "LS-WHT-M", "Shirts", "M", "White", "", 5800, 2200, 6, 4],
      ["Linen Shirt", "LS-NVY-M", "Shirts", "M", "Navy", "", 5800, 2200, 4, 4],
      ["Linen Shirt", "LS-NVY-L", "Shirts", "L", "Navy", "", 5800, 2200, 9, 4],
      ["Selvedge Jeans", "SJ-IND-30", "Pants", "30", "Indigo", "", 12800, 5200, 7, 3],
      ["Selvedge Jeans", "SJ-IND-32", "Pants", "32", "Indigo", "", 12800, 5200, 2, 3],
      ["Selvedge Jeans", "SJ-IND-34", "Pants", "34", "Indigo", "", 12800, 5200, 5, 3],
      ["Wool Beanie", "WB-CHR", "Accessories", "One size", "Charcoal", "", 2800, 900, 20, 6],
      ["Wool Beanie", "WB-RST", "Accessories", "One size", "Rust", "", 2800, 900, 1, 6],
      ["Canvas Tote", "CT-NAT", "Accessories", "One size", "Natural", "", 3200, 1100, 15, 5],
      ["Leather Belt", "LB-BRN-M", "Accessories", "M", "Brown", "", 4800, 1800, 0, 2],
      ["Leather Belt", "LB-BLK-M", "Accessories", "M", "Black", "", 4800, 1800, 6, 2],
    ]],
    [flea, [
      ["Vintage Band Tee", "VT-BLK-S", "T-Shirts", "S", "Black", "", 3500, 900, 6, 3],
      ["Vintage Band Tee", "VT-BLK-M", "T-Shirts", "M", "Black", "", 3500, 900, 8, 3],
      ["Vintage Band Tee", "VT-BLK-L", "T-Shirts", "L", "Black", "", 3500, 900, 3, 3],
      ["Vintage Band Tee", "VT-WHT-M", "T-Shirts", "M", "White", "", 3500, 900, 10, 3],
      ["Denim Jacket", "DJ-LT-M", "Outerwear", "M", "Light wash", "", 8500, 3000, 4, 2],
      ["Denim Jacket", "DJ-LT-L", "Outerwear", "L", "Light wash", "", 8500, 3000, 2, 2],
      ["Denim Jacket", "DJ-DK-M", "Outerwear", "M", "Dark wash", "", 8500, 3000, 5, 2],
      ["Crewneck Sweater", "CS-OAT-M", "Knitwear", "M", "Oatmeal", "", 6400, 2400, 7, 3],
      ["Crewneck Sweater", "CS-OAT-L", "Knitwear", "L", "Oatmeal", "", 6400, 2400, 2, 3],
      ["Crewneck Sweater", "CS-GRN-M", "Knitwear", "M", "Forest", "", 6400, 2400, 6, 3],
      ["Bucket Hat", "BH-KHK", "Accessories", "One size", "Khaki", "", 2400, 700, 12, 4],
      ["Bucket Hat", "BH-BLK", "Accessories", "One size", "Black", "", 2400, 700, 3, 4],
      ["Patch Pack", "PP-MIX", "Accessories", "One size", "Mixed", "", 1200, 300, 25, 8],
    ]],
    [winter, [
      ["Puffer Vest", "PV-BLK-M", "Outerwear", "M", "Black", "", 9800, 3800, 8, 3],
      ["Puffer Vest", "PV-BLK-L", "Outerwear", "L", "Black", "", 9800, 3800, 6, 3],
      ["Fleece Pullover", "FP-CRM-M", "Outerwear", "M", "Cream", "", 7400, 2600, 5, 3],
      ["Fleece Pullover", "FP-CRM-S", "Outerwear", "S", "Cream", "", 7400, 2600, 0, 3],
      ["Knit Scarf", "KS-RED", "Accessories", "One size", "Red", "", 3600, 1200, 14, 5],
      ["Knit Mittens", "KM-GRY", "Accessories", "One size", "Grey", "", 2600, 800, 2, 4],
    ]],
  ];
  const bySku = new Map<string, string>();
  for (const [st, list] of rows) {
    for (const [name, sku, category, size, color, , price, cost, qty, threshold] of list) {
      const it = createItem(s, ownerId, { store_id: st.id, name, sku, category, size, color, price_cents: price,
        cost_cents: cost, quantity: qty, low_stock_threshold: threshold });
      it.created_at = iso(14 * DAY);
      bySku.set(sku, it.id);
    }
  }
  setSetupLocked(s, ownerId, main.id, true);
  setSetupLocked(s, ownerId, flea.id, true);

  const H = 3_600_000;
  const sales: [string, string, number, number][] = [
    [maya.id, "LS-WHT-S", 2, 5 * DAY + 3 * H], [maya.id, "SJ-IND-30", 1, 4 * DAY + 5 * H], [maya.id, "WB-CHR", 3, 3 * DAY + 2 * H],
    [maya.id, "LS-WHT-M", 3, 2 * DAY + 4 * H], [maya.id, "CT-NAT", 2, DAY + 6 * H], [maya.id, "SJ-IND-32", 1, DAY + H],
    [maya.id, "LS-NVY-L", 1, 4 * H], [maya.id, "LB-BLK-M", 1, 2 * H],
    [leo.id, "VT-BLK-M", 2, 2 * DAY + H], [maya.id, "DJ-LT-M", 1, 2 * DAY], [leo.id, "CS-OAT-M", 2, DAY + 5 * H],
    [leo.id, "VT-BLK-L", 3, DAY + 3 * H], [maya.id, "PP-MIX", 5, DAY + 2 * H], [leo.id, "BH-KHK", 2, 5 * H],
    [leo.id, "VT-BLK-S", 2, 3 * H], [maya.id, "DJ-LT-L", 1, 2.5 * H], [leo.id, "VT-WHT-M", 1, 1.5 * H],
    [maya.id, "CS-GRN-M", 1, 0.75 * H], [leo.id, "BH-BLK", 1, 0.33 * H], [maya.id, "VT-BLK-M", 1, 0.17 * H],
  ];
  for (const [who, sku, qty, ago] of sales) sellItem(s, who, bySku.get(sku)!, qty, iso(ago));

  const returned = sellItem(s, ownerId, bySku.get("DJ-DK-M")!, 1, iso(DAY + 4 * H));
  voidSale(s, ownerId, returned.sale_id);

  requestApproval(s, maya.id, "void_sale", s.sales.find((x) => x.item_id === bySku.get("CS-GRN-M"))!.id,
    "Customer changed their mind right away");
  requestApproval(s, leo.id, "edit_item", bySku.get("PP-MIX")!, "Price tag says $10, not $12", { price_cents: 1000 });

  const at = (dayOffset: number, hour: number) => {
    const d = new Date(); d.setHours(hour, 0, 0, 0); d.setDate(d.getDate() + dayOffset);
    return d.toISOString();
  };
  const shift = (who: string, st: DemoStore, start: string, end: string | null, rate: number) =>
    s.shifts.push({ id: newId(), business_id: biz, store_id: st.id, profile_id: who, clock_in: start, clock_out: end,
      hourly_rate_cents_snapshot: rate, note: null, edited_by: null });
  shift(maya.id, main, at(-5, 9), at(-5, 17), 1800);
  shift(maya.id, main, at(-4, 10), at(-4, 16), 1800);
  shift(maya.id, flea, at(-2, 8), at(-2, 18), 1800);
  shift(leo.id, flea, at(-2, 8), at(-2, 18), 1650);
  shift(leo.id, flea, at(-1, 8), null, 1650); // forgot to clock out -> flagged on payroll
  s.pay.find((p) => p.profile_id === maya.id)!.hourly_rate_cents = 1900; // later raise; past shifts keep $18
  clockIn(s, maya.id, flea.id);
  s.shifts[s.shifts.length - 1].clock_in = iso(3 * H + 10 * 60_000);
  void addStock; void winter;

  return { maya: maya.email, leo: leo.email };
}
