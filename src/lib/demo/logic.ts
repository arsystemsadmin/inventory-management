"use client";

/**
 * Browser copy of the database rules (RLS policies, triggers and functions in
 * supabase/migrations). Error codes match the SQL ones so friendlyError() maps
 * them to the same messages.
 */
import { stockStatus } from "@/lib/format";
import type { Item, SellResult } from "@/lib/types";
import {
  newId, type DemoApproval, type DemoItem, type DemoShift, type DemoState, type DemoStore, type DemoUser,
} from "./store";

export class DemoError extends Error {
  constructor(code: string, public details?: string) { super(code); }
}
const fail = (code: string, details?: string): never => { throw new DemoError(code, details); };
const nowIso = () => new Date().toISOString();

// ---------------------------------------------------------------- scoping ---

export function currentUser(s: DemoState, uid: string | null): DemoUser | null {
  const u = s.users.find((x) => x.id === uid);
  return u && u.active ? u : null;
}
export const isOwner = (u: DemoUser | null) => !!u && u.role === "owner";
export function isMember(s: DemoState, u: DemoUser, storeId: string) {
  return s.members.some((m) => m.store_id === storeId && m.profile_id === u.id && m.business_id === u.business_id);
}
export function canAccessStore(s: DemoState, u: DemoUser | null, storeId: string) {
  if (!u) return false;
  const store = s.stores.find((x) => x.id === storeId);
  return !!store && store.business_id === u.business_id && (isOwner(u) || isMember(s, u, storeId));
}
const requireUser = (s: DemoState, uid: string | null) => currentUser(s, uid) ?? fail("NOT_AUTHENTICATED");
const requireOwner = (s: DemoState, uid: string | null) => {
  const u = requireUser(s, uid);
  if (!isOwner(u)) fail("OWNER_ONLY");
  return u;
};

export function visibleStores(s: DemoState, u: DemoUser | null) {
  return u ? s.stores.filter((x) => canAccessStore(s, u, x.id)) : [];
}
export function withStatus(i: DemoItem): Item {
  return { ...i, stock_status: stockStatus(i.quantity, i.low_stock_threshold) };
}
export function visibleItems(s: DemoState, u: DemoUser | null): Item[] {
  return u ? s.items.filter((i) => canAccessStore(s, u, i.store_id)).map(withStatus) : [];
}
export function visibleSales(s: DemoState, u: DemoUser | null) {
  return u ? s.sales.filter((x) => canAccessStore(s, u, x.store_id)) : [];
}
export function visibleShifts(s: DemoState, u: DemoUser | null) {
  if (!u) return [];
  return s.shifts.filter((t) => t.business_id === u.business_id && (isOwner(u) || t.profile_id === u.id));
}
export function visibleApprovals(s: DemoState, u: DemoUser | null) {
  if (!u) return [];
  return s.approvals.filter((r) => r.business_id === u.business_id && (isOwner(u) || r.requested_by === u.id));
}
export function visiblePeople(s: DemoState, u: DemoUser | null) {
  if (!u) return [];
  const myStores = new Set(s.members.filter((m) => m.profile_id === u.id).map((m) => m.store_id));
  return s.users.filter((p) => p.business_id === u.business_id && (
    isOwner(u) || p.id === u.id || s.members.some((m) => m.profile_id === p.id && myStores.has(m.store_id))
  ));
}
export function visiblePay(s: DemoState, u: DemoUser | null) {
  if (!u) return [];
  return s.pay.filter((p) => p.business_id === u.business_id && (isOwner(u) || p.profile_id === u.id));
}

// ---------------------------------------------------------- time helpers ---

export function shiftPay(t: DemoShift, now = Date.now()) {
  const end = t.clock_out ? Date.parse(t.clock_out) : now;
  const seconds = Math.max(0, (end - Date.parse(t.clock_in)) / 1000);
  return {
    is_open: t.clock_out === null,
    worked_minutes: Math.floor(seconds / 60),
    amount_cents: Math.round((seconds / 3600) * t.hourly_rate_cents_snapshot),
  };
}
/** Local midnight today / Monday this week (the demo uses the browser's timezone). */
export function periodStart(kind: "day" | "week", now = new Date()) {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  if (kind === "week") d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d;
}

// --------------------------------------------------------- inventory ops ---

function moveStock(s: DemoState, item: DemoItem, delta: number, reason: "restock" | "edit" | "sale" | "void", actor: string, saleId: string | null = null) {
  item.quantity += delta;
  item.updated_at = nowIso();
  item.updated_by = actor;
  s.movements.push({
    id: newId(), business_id: item.business_id, store_id: item.store_id, item_id: item.id, delta,
    quantity_after: item.quantity, reason, sale_id: saleId, actor_id: actor, created_at: nowIso(),
  });
}

function findItem(s: DemoState, u: DemoUser, id: string) {
  const item = s.items.find((i) => i.id === id && i.business_id === u.business_id);
  if (!item || !canAccessStore(s, u, item.store_id)) fail("ITEM_NOT_FOUND");
  return item!;
}

export function sellItem(s: DemoState, uid: string | null, itemId: string, qty: number, at?: string): SellResult {
  const u = requireUser(s, uid);
  if (!Number.isInteger(qty) || qty <= 0 || qty > 10000) fail("INVALID_QUANTITY");
  const item = s.items.find((i) => i.id === itemId && i.business_id === u.business_id) ?? fail("ITEM_NOT_FOUND");
  if (!canAccessStore(s, u, item.store_id)) fail("NOT_STORE_MEMBER");
  if (item.archived) fail("ITEM_ARCHIVED");
  if (s.stores.find((x) => x.id === item.store_id)?.status === "closed") fail("STORE_CLOSED");
  if (item.quantity < qty) fail("OUT_OF_STOCK", `Requested ${qty}, only ${item.quantity} left`);
  const before = stockStatus(item.quantity, item.low_stock_threshold);
  const sale = {
    id: newId(), business_id: item.business_id, store_id: item.store_id, item_id: item.id, sold_by: u.id,
    item_name: item.name, size: item.size, color: item.color, quantity: qty, unit_price_cents: item.price_cents,
    total_cents: qty * item.price_cents, created_at: at ?? nowIso(), voided_at: null, voided_by: null,
  };
  s.sales.push(sale);
  moveStock(s, item, -qty, "sale", u.id, sale.id);
  return {
    sale_id: sale.id, item_id: item.id, item_name: item.name, size: item.size, color: item.color,
    quantity_sold: qty, total_cents: sale.total_cents, quantity_after: item.quantity,
    status_before: before, status_after: stockStatus(item.quantity, item.low_stock_threshold),
  };
}

type ItemFields = {
  image_path?: string | null;
  name: string; sku: string | null; category: string | null; size: string | null; color: string | null;
  price_cents: number; cost_cents: number; low_stock_threshold: number;
};

function checkSku(s: DemoState, storeId: string, sku: string | null, exceptId?: string) {
  if (sku && s.items.some((i) => i.store_id === storeId && !i.archived && i.id !== exceptId && i.sku?.toLowerCase() === sku.toLowerCase())) {
    throw Object.assign(new DemoError("DUPLICATE"), { code: "23505" });
  }
}

export function createItem(s: DemoState, uid: string | null, input: ItemFields & { store_id: string; quantity: number }) {
  const u = requireUser(s, uid);
  if (!canAccessStore(s, u, input.store_id)) fail("NOT_STORE_MEMBER");
  checkSku(s, input.store_id, input.sku);
  const store = s.stores.find((x) => x.id === input.store_id)!;
  const item: DemoItem = {
    ...input, image_path: input.image_path ?? null, id: newId(), business_id: store.business_id, store_id: store.id, archived: false,
    created_at: nowIso(), updated_at: nowIso(), created_by: u.id, updated_by: u.id,
  };
  s.items.push(item);
  s.movements.push({
    id: newId(), business_id: item.business_id, store_id: item.store_id, item_id: item.id, delta: item.quantity,
    quantity_after: item.quantity, reason: "initial", sale_id: null, actor_id: u.id, created_at: nowIso(),
  });
  return item;
}

/** Owner, or the store is still in setup mode. */
export function canEditDirectly(s: DemoState, u: DemoUser, storeId: string) {
  return isOwner(u) || s.stores.find((x) => x.id === storeId)?.inventory_locked_at === null;
}

export function editItem(s: DemoState, uid: string | null, itemId: string, changes: Partial<ItemFields> & { quantity_delta?: number }) {
  const u = requireUser(s, uid);
  const item = findItem(s, u, itemId);
  if (!canEditDirectly(s, u, item.store_id)) fail("EDIT_REQUIRES_APPROVAL");
  applyEdit(s, u, item, changes);
}

function applyEdit(s: DemoState, u: DemoUser, item: DemoItem, changes: Partial<ItemFields> & { quantity_delta?: number }) {
  const { quantity_delta, ...fields } = changes;
  if (fields.sku !== undefined) checkSku(s, item.store_id, fields.sku, item.id);
  if (quantity_delta && item.quantity + quantity_delta < 0) {
    fail("OUT_OF_STOCK", `Cannot remove ${-quantity_delta}, only ${item.quantity} left`);
  }
  Object.assign(item, fields, { updated_at: nowIso(), updated_by: u.id });
  if (quantity_delta) moveStock(s, item, quantity_delta, quantity_delta > 0 ? "restock" : "edit", u.id);
}

/** Photos never need approval: they don't change stock or price. */
export function setItemImage(s: DemoState, uid: string | null, itemId: string, path: string | null) {
  const u = requireUser(s, uid);
  const item = findItem(s, u, itemId);
  item.image_path = path;
  item.updated_at = nowIso();
}

export function addStock(s: DemoState, uid: string | null, itemId: string, qty: number) {
  const u = requireUser(s, uid);
  const item = findItem(s, u, itemId);
  if (item.archived) fail("ITEM_NOT_FOUND");
  moveStock(s, item, qty, "restock", u.id);
  return item.quantity;
}

export function removeStock(s: DemoState, uid: string | null, itemId: string, qty: number) {
  const u = requireUser(s, uid);
  const item = findItem(s, u, itemId);
  if (!canEditDirectly(s, u, item.store_id)) fail("STOCK_REMOVAL_REQUIRES_APPROVAL");
  if (item.quantity < qty) fail("OUT_OF_STOCK");
  moveStock(s, item, -qty, "edit", u.id);
}

export function setArchived(s: DemoState, uid: string | null, itemId: string, archived: boolean) {
  const u = requireUser(s, uid);
  if (!isOwner(u)) fail("ARCHIVE_REQUIRES_APPROVAL");
  const item = findItem(s, u, itemId);
  item.archived = archived;
  item.updated_at = nowIso();
}

// -------------------------------------------------------------- approvals ---

const EDITABLE = ["name", "sku", "category", "size", "color", "price_cents", "cost_cents", "low_stock_threshold", "quantity_delta"];

export function requestApproval(
  s: DemoState, uid: string | null, kind: DemoApproval["kind"], targetId: string, reason?: string | null,
  changes?: Record<string, string | number | null> | null,
) {
  const u = requireUser(s, uid);
  let storeId: string | undefined;
  if (kind === "void_sale") {
    const sale = s.sales.find((x) => x.id === targetId && x.business_id === u.business_id);
    if (sale?.voided_at) fail("SALE_ALREADY_VOIDED");
    storeId = sale?.store_id;
  } else {
    storeId = s.items.find((x) => x.id === targetId && x.business_id === u.business_id)?.store_id;
  }
  if (!storeId || !canAccessStore(s, u, storeId)) fail("NOT_FOUND");
  if (kind === "edit_item") {
    if (!changes || Object.keys(changes).length === 0) fail("NO_CHANGES");
    for (const k of Object.keys(changes!)) if (!EDITABLE.includes(k)) fail("INVALID_CHANGE_FIELD", k);
  }
  const dupe = s.approvals.some((r) => r.status === "pending" && r.kind === kind &&
    (kind === "void_sale" ? r.sale_id === targetId : r.item_id === targetId));
  if (dupe) fail("REQUEST_ALREADY_PENDING");
  const req: DemoApproval = {
    id: newId(), business_id: u.business_id, store_id: storeId!, kind,
    item_id: kind === "void_sale" ? null : targetId, sale_id: kind === "void_sale" ? targetId : null,
    changes: kind === "edit_item" ? changes! : null, reason: reason?.trim() || null, status: "pending",
    requested_by: u.id, requested_at: nowIso(), decided_by: null, decided_at: null, decision_note: null,
  };
  s.approvals.push(req);
  return req.id;
}

export function voidSale(s: DemoState, uid: string | null, saleId: string) {
  const u = requireOwner(s, uid);
  const sale = s.sales.find((x) => x.id === saleId && x.business_id === u.business_id) ?? fail("SALE_NOT_FOUND");
  if (sale.voided_at) fail("SALE_ALREADY_VOIDED");
  sale.voided_at = nowIso();
  sale.voided_by = u.id;
  const item = s.items.find((i) => i.id === sale.item_id);
  if (item) moveStock(s, item, sale.quantity, "void", u.id, sale.id);
}

export function decideApproval(s: DemoState, uid: string | null, requestId: string, approve: boolean, note?: string) {
  const u = requireOwner(s, uid);
  const req = s.approvals.find((r) => r.id === requestId && r.business_id === u.business_id) ?? fail("NOT_FOUND");
  if (req.status !== "pending") fail("ALREADY_DECIDED");
  if (approve) {
    if (req.kind === "void_sale") voidSale(s, uid, req.sale_id!);
    else if (req.kind === "archive_item") setArchived(s, uid, req.item_id!, true);
    else applyEdit(s, u, findItem(s, u, req.item_id!), req.changes as Partial<ItemFields> & { quantity_delta?: number });
  }
  Object.assign(req, {
    status: approve ? "approved" : "rejected", decided_by: u.id, decided_at: nowIso(), decision_note: note?.trim() || null,
  });
}

// ----------------------------------------------------------------- stores ---

export function saveStore(s: DemoState, uid: string | null, row: Pick<DemoStore, "name" | "type" | "address" | "starts_at" | "ends_at" | "status">, id?: string) {
  const u = requireOwner(s, uid);
  if (id) {
    const store = s.stores.find((x) => x.id === id && x.business_id === u.business_id) ?? fail("NOT_FOUND");
    Object.assign(store, row);
    return store.id;
  }
  const store: DemoStore = {
    id: newId(), business_id: u.business_id, ...row, inventory_locked_at: null, inventory_locked_by: null, created_at: nowIso(),
  };
  s.stores.push(store);
  return store.id;
}

export function setSetupLocked(s: DemoState, uid: string | null, storeId: string, locked: boolean) {
  const u = requireUser(s, uid);
  if (!canAccessStore(s, u, storeId)) fail("NOT_FOUND");
  if (!locked && !isOwner(u)) fail("OWNER_ONLY");
  const store = s.stores.find((x) => x.id === storeId)!;
  if (locked && store.inventory_locked_at) return;
  store.inventory_locked_at = locked ? nowIso() : null;
  store.inventory_locked_by = locked ? u.id : null;
}

export function setStoreMembers(s: DemoState, uid: string | null, storeId: string, profileIds: string[]) {
  const u = requireOwner(s, uid);
  if (!canAccessStore(s, u, storeId)) fail("NOT_FOUND");
  const valid = profileIds.filter((id) => s.users.some((p) => p.id === id && p.business_id === u.business_id));
  s.members = s.members.filter((m) => m.store_id !== storeId)
    .concat(valid.map((profile_id) => ({ store_id: storeId, profile_id, business_id: u.business_id })));
}

// -------------------------------------------------------------- employees ---

export function createEmployee(
  s: DemoState, uid: string | null,
  v: { full_name: string; email: string; password_hash: string; hourly_rate_cents: number; store_ids: string[] },
) {
  const u = requireOwner(s, uid);
  if (s.users.some((p) => p.email.toLowerCase() === v.email.toLowerCase())) fail("EMAIL_TAKEN");
  const id = newId();
  s.users.push({
    id, business_id: u.business_id, full_name: v.full_name, email: v.email.toLowerCase(), role: "employee",
    active: true, password_hash: v.password_hash, created_at: nowIso(),
  });
  s.pay.push({ profile_id: id, business_id: u.business_id, hourly_rate_cents: v.hourly_rate_cents, updated_at: nowIso() });
  for (const store_id of v.store_ids) {
    if (canAccessStore(s, u, store_id)) s.members.push({ store_id, profile_id: id, business_id: u.business_id });
  }
  return id;
}

export function updateEmployee(
  s: DemoState, uid: string | null, v: { profile_id: string; full_name: string; hourly_rate_cents: number; store_ids: string[] },
) {
  const u = requireOwner(s, uid);
  const p = s.users.find((x) => x.id === v.profile_id && x.business_id === u.business_id) ?? fail("NOT_FOUND");
  p.full_name = v.full_name;
  const pay = s.pay.find((x) => x.profile_id === p.id);
  if (pay) Object.assign(pay, { hourly_rate_cents: v.hourly_rate_cents, updated_at: nowIso() });
  else s.pay.push({ profile_id: p.id, business_id: u.business_id, hourly_rate_cents: v.hourly_rate_cents, updated_at: nowIso() });
  s.members = s.members.filter((m) => m.profile_id !== p.id)
    .concat(v.store_ids.filter((id) => canAccessStore(s, u, id)).map((store_id) => ({ store_id, profile_id: p.id, business_id: u.business_id })));
}

export function setEmployeeActive(s: DemoState, uid: string | null, profileId: string, active: boolean) {
  const u = requireOwner(s, uid);
  const p = s.users.find((x) => x.id === profileId && x.business_id === u.business_id && x.role === "employee") ?? fail("NOT_FOUND");
  p.active = active;
}

// ------------------------------------------------------------------- time ---

export function clockIn(s: DemoState, uid: string | null, storeId: string) {
  const u = requireUser(s, uid);
  if (!canAccessStore(s, u, storeId)) fail("NOT_STORE_MEMBER");
  if (s.stores.find((x) => x.id === storeId)?.status === "closed") fail("STORE_CLOSED");
  if (s.shifts.some((t) => t.profile_id === u.id && t.clock_out === null)) fail("ALREADY_CLOCKED_IN");
  s.shifts.push({
    id: newId(), business_id: u.business_id, store_id: storeId, profile_id: u.id, clock_in: nowIso(), clock_out: null,
    hourly_rate_cents_snapshot: s.pay.find((p) => p.profile_id === u.id)?.hourly_rate_cents ?? 0, note: null, edited_by: null,
  });
}

export function clockOut(s: DemoState, uid: string | null) {
  const u = requireUser(s, uid);
  const open = s.shifts.find((t) => t.profile_id === u.id && t.clock_out === null) ?? fail("NOT_CLOCKED_IN");
  open.clock_out = nowIso();
}

export function saveShift(
  s: DemoState, uid: string | null,
  v: { id?: string; profile_id: string; store_id: string; clock_in: string; clock_out: string | null; hourly_rate_cents_snapshot: number; note: string | null },
) {
  const u = requireOwner(s, uid);
  if (!s.users.some((p) => p.id === v.profile_id && p.business_id === u.business_id) || !canAccessStore(s, u, v.store_id)) fail("NOT_FOUND");
  if (!v.clock_out && s.shifts.some((t) => t.profile_id === v.profile_id && t.clock_out === null && t.id !== v.id)) {
    throw Object.assign(new DemoError("OPEN_SHIFT_EXISTS"), { code: "23505" });
  }
  if (v.id) {
    const t = s.shifts.find((x) => x.id === v.id && x.business_id === u.business_id) ?? fail("NOT_FOUND");
    Object.assign(t, v, { edited_by: u.id });
  } else {
    s.shifts.push({ ...v, id: newId(), business_id: u.business_id, edited_by: u.id });
  }
}

export function deleteShift(s: DemoState, uid: string | null, id: string) {
  const u = requireOwner(s, uid);
  s.shifts = s.shifts.filter((t) => !(t.id === id && t.business_id === u.business_id));
}
