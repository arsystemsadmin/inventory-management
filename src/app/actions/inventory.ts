"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { friendlyError } from "@/lib/errors";
import type { ActionResult, AddVariationsResult, CartLineInput, CartResult, PaymentInput, SellResult } from "@/lib/types";
import { variantLabel } from "@/lib/format";

import { cartSchema, itemFields, newItemSchema, newItemsSchema, paymentSchema, qty, STORAGE_IMAGE_PATH, uuid } from "@/lib/validation";
import { getTr } from "@/i18n/server";
import { logged } from "@/lib/error-log";

const badImage = (p: string | null | undefined) => !!p && !STORAGE_IMAGE_PATH.test(p);

function revalidateInventory() {
  revalidatePath("/inventory");
  revalidatePath("/stores", "layout");
  revalidatePath("/dashboard");
}

/** Owner, or store still in setup mode -> change directly; otherwise needs approval. */
async function canEditDirectly(storeId: string) {
  const profile = await getCurrentProfile();
  if (!profile) return false;
  if (profile.role === "owner") return true;
  const supabase = await createClient();
  const { data } = await supabase.from("stores").select("inventory_locked_at").eq("id", storeId).single();
  return !!data && data.inventory_locked_at === null;
}

async function sellItemImpl(input: { itemId: string; quantity: number; payment?: PaymentInput }): Promise<ActionResult<SellResult>> {
  const tr = await getTr();
  const parsed = z.object({ itemId: uuid, quantity: qty, payment: paymentSchema.optional() }).safeParse(input);
  if (!parsed.success) return { ok: false, error: tr(parsed.error.issues[0].message) };
  const payment = parsed.data.payment ?? { method: "cash" as const };
  const supabase = await createClient();
  let { data, error } = await supabase.rpc("sell_item", {
    p_item_id: parsed.data.itemId, p_qty: parsed.data.quantity,
    p_payment_method: payment.method, p_cash_cents: payment.method === "split" ? payment.cash_cents ?? null : null,
  });
  // Database not migrated yet (payment-method migration 20261126000011): record the sale the old way.
  if (error?.code === "PGRST202") {
    ({ data, error } = await supabase.rpc("sell_item", { p_item_id: parsed.data.itemId, p_qty: parsed.data.quantity }));
  }
  if (error) return { ok: false, error: friendlyError(error, tr) };
  revalidateInventory();
  revalidatePath("/sales");
  return { ok: true, data: data as SellResult };
}

/** Several variations in one checkout, all or nothing (sell_cart). */
async function sellCartImpl(input: { lines: CartLineInput[]; payment: PaymentInput }): Promise<ActionResult<CartResult>> {
  const tr = await getTr();
  const parsed = cartSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: tr(parsed.error.issues[0].message) };
  const { lines, payment } = parsed.data;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("sell_cart", {
    p_lines: lines.map((l) => ({ item_id: l.itemId, quantity: l.quantity })),
    p_payment_method: payment.method,
    p_cash_cents: payment.method === "split" ? payment.cash_cents ?? null : null,
  });
  // Database not updated yet (migration 20261127000015).
  if (error?.code === "PGRST202") return { ok: false, error: tr("errors.cartNeedsUpdate") };
  if (error) return { ok: false, error: friendlyError(error, tr) };
  revalidateInventory();
  revalidatePath("/sales");
  return { ok: true, data: data as CartResult };
}

async function createItemImpl(input: unknown): Promise<ActionResult> {
  const tr = await getTr();
  const parsed = newItemSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: tr(parsed.error.issues[0].message) };
  if (badImage(parsed.data.image_path) || badImage(parsed.data.variant_image_path) || badImage(parsed.data.variation_image_path)) {
    return { ok: false, error: tr("errors.invalidPhoto") };
  }
  const supabase = await createClient();
  // business_id is filled by trigger from the store; RLS checks membership.
  const { variation_image_path, ...row } = parsed.data;
  const insertRow: Record<string, unknown> = variation_image_path ? { ...row, variation_image_path } : row;
  const { error } = await supabase.from("items").insert(insertRow);
  if (error) return { ok: false, error: friendlyError(error, tr) };
  revalidateInventory();
  return { ok: true, message: tr("toasts.itemAdded") };
}

/** Creates several variants (e.g. one per size) in a single insert, so it's all-or-nothing. */
async function createItemsImpl(input: unknown): Promise<ActionResult<AddVariationsResult>> {
  const tr = await getTr();
  const parsed = newItemsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: tr(parsed.error.issues[0].message) };
  if (parsed.data.some((r) => badImage(r.image_path) || badImage(r.variant_image_path) || badImage(r.variation_image_path))) {
    return { ok: false, error: tr("errors.invalidPhoto") };
  }
  const supabase = await createClient();

  // Skip size/color combinations the product already has (e.g. a retry after a
  // save that did go through) instead of failing the whole batch. Same rule as
  // the items_variant_unique index: store + name + size + color, case-insensitive.
  const norm = (v: string | null | undefined) => (v ?? "").trim().toLowerCase();
  const keyOf = (r: { store_id: string; name: string; size?: string | null; color?: string | null }) =>
    [r.store_id, norm(r.name), norm(r.size), norm(r.color)].join("|");
  const storeIds = [...new Set(parsed.data.map((r) => r.store_id))];
  const { data: existing } = await supabase.from("items").select("store_id, name, size, color")
    .in("store_id", storeIds).eq("archived", false);
  const taken = new Set((existing ?? []).map(keyOf));
  const fresh = parsed.data.filter((r) => !taken.has(keyOf(r)));
  const skipped = parsed.data.filter((r) => taken.has(keyOf(r))).map((r) => variantLabel(r.size, r.color) || r.name);

  if (fresh.length === 0) {
    return { ok: false, error: tr("errors.allVariantsExist", { list: skipped.join(", ") }) };
  }
  // Only send the variation photo when set, so inserts work even before the
  // variation_image_path column exists (migration 20261120000010).
  const rows: Record<string, unknown>[] = fresh.map(({ variation_image_path, ...r }) => (variation_image_path ? { ...r, variation_image_path } : r));
  const { error } = await supabase.from("items").insert(rows);
  if (error) return { ok: false, error: friendlyError(error, tr) };
  revalidateInventory();
  return {
    ok: true,
    data: { added: fresh.length, skipped },
    message: skipped.length
      ? tr("toasts.addedSomeSkipped", { count: fresh.length, list: skipped.join(", ") })
      : tr("toasts.itemsAdded", { count: fresh.length }),
  };
}

async function saveItemEditImpl(input: { itemId: string; changes: unknown; reason?: string }): Promise<ActionResult<"applied" | "requested">> {
  const tr = await getTr();
  const id = uuid.safeParse(input.itemId);
  const changes = itemFields.partial().safeParse(input.changes);
  if (!id.success || !changes.success) return { ok: false, error: changes.error?.issues[0].message ?? tr("errors.invalidItem") };
  const { image_path, variant_image_path, variation_image_path, ...rest } = changes.data;
  const diff = Object.fromEntries(Object.entries(rest).filter(([, v]) => v !== undefined));
  const raw = input.changes as object;
  const photo: { image_path?: string | null; variant_image_path?: string | null; variation_image_path?: string | null } = {};
  if ("image_path" in raw) photo.image_path = image_path ?? null;
  if ("variant_image_path" in raw) photo.variant_image_path = variant_image_path ?? null;
  if ("variation_image_path" in raw) photo.variation_image_path = variation_image_path ?? null;
  const imageChanged = Object.keys(photo).length > 0;
  if (Object.keys(diff).length === 0 && !imageChanged) return { ok: false, error: tr("errors.NO_CHANGES") };
  if (badImage(photo.image_path) || badImage(photo.variant_image_path) || badImage(photo.variation_image_path)) {
    return { ok: false, error: tr("errors.invalidPhoto") };
  }

  const supabase = await createClient();
  const { data: item } = await supabase.from("items").select("store_id").eq("id", id.data).single();
  if (!item) return { ok: false, error: tr("errors.ITEM_NOT_FOUND") };

  // Photos never need approval (they don't change stock or price).
  if (imageChanged) {
    const { error } = await supabase.from("items").update(photo).eq("id", id.data);
    if (error) return { ok: false, error: friendlyError(error, tr) };
    if (Object.keys(diff).length === 0) {
      revalidateInventory();
      const added = Object.values(photo).some(Boolean);
      return { ok: true, data: "applied", message: added ? tr("toasts.photoUpdated") : tr("toasts.photoRemoved") };
    }
  }

  if (await canEditDirectly(item.store_id)) {
    const { error } = await supabase.from("items").update(diff).eq("id", id.data);
    if (error) return { ok: false, error: friendlyError(error, tr) };
    revalidateInventory();
    return { ok: true, data: "applied", message: tr("toasts.itemUpdated") };
  }
  const { error } = await supabase.rpc("request_approval", {
    p_kind: "edit_item", p_target_id: id.data, p_reason: input.reason ?? null, p_changes: diff,
  });
  if (error) return { ok: false, error: friendlyError(error, tr) };
  revalidatePath("/approvals");
  return { ok: true, data: "requested", message: tr("toasts.editRequested") };
}

/**
 * Edits a whole product: applies the same changes (name, category, photo,
 * price…) to every variation. Each variation goes through saveItemEdit, so
 * setup-lock approval rules apply exactly as for single edits.
 */
async function saveProductEditImpl(input: { storeId: string; name: string; changes: unknown; reason?: string }): Promise<ActionResult> {
  const tr = await getTr();
  const parsed = z.object({ storeId: uuid, name: z.string().trim().min(1).max(200) }).safeParse(input);
  if (!parsed.success) return { ok: false, error: tr("errors.invalidProduct") };
  const supabase = await createClient();
  const { data } = await supabase.from("items").select("id, name").eq("store_id", parsed.data.storeId).eq("archived", false);
  const ids = (data ?? []).filter((r) => r.name.trim().toLowerCase() === parsed.data.name.toLowerCase()).map((r) => r.id);
  if (!ids.length) return { ok: false, error: tr("errors.productNotFound") };
  let requested = false;
  for (const itemId of ids) {
    const res = await saveItemEditImpl({ itemId, changes: input.changes, reason: input.reason });
    if (!res.ok) return res;
    if (res.data === "requested") requested = true;
  }
  return { ok: true, message: requested ? tr("toasts.changesRequested") : tr("toasts.productUpdated") };
}

async function addStockImpl(input: { itemId: string; quantity: number }): Promise<ActionResult<number>> {
  const tr = await getTr();
  const parsed = z.object({ itemId: uuid, quantity: qty }).safeParse(input);
  if (!parsed.success) return { ok: false, error: tr(parsed.error.issues[0].message) };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("add_stock", { p_item_id: parsed.data.itemId, p_qty: parsed.data.quantity });
  if (error) return { ok: false, error: friendlyError(error, tr) };
  revalidateInventory();
  return { ok: true, data: data as number, message: tr("toasts.stockAdded", { count: parsed.data.quantity }) };
}

async function removeStockImpl(input: { itemId: string; quantity: number; reason?: string }): Promise<ActionResult> {
  const tr = await getTr();
  const parsed = z.object({ itemId: uuid, quantity: qty, reason: z.string().max(500).optional() }).safeParse(input);
  if (!parsed.success) return { ok: false, error: tr(parsed.error.issues[0].message) };
  const supabase = await createClient();
  const { data: item } = await supabase.from("items").select("store_id, quantity").eq("id", parsed.data.itemId).single();
  if (!item) return { ok: false, error: tr("errors.ITEM_NOT_FOUND") };
  // Can't remove more than what's there (it may have just been sold).
  if (parsed.data.quantity > item.quantity) {
    return { ok: false, error: tr("errors.removeTooMany", { count: item.quantity }) };
  }

  if (await canEditDirectly(item.store_id)) {
    const { error } = await supabase.rpc("remove_stock", { p_item_id: parsed.data.itemId, p_qty: parsed.data.quantity });
    if (error?.message?.includes("OUT_OF_STOCK")) {
      const { data: now } = await supabase.from("items").select("quantity").eq("id", parsed.data.itemId).single();
      return { ok: false, error: tr("errors.removeTooMany", { count: now?.quantity ?? 0 }) };
    }
    if (error) return { ok: false, error: friendlyError(error, tr) };
    revalidateInventory();
    return { ok: true, message: tr("toasts.stockRemoved", { count: parsed.data.quantity }) };
  }
  const { error } = await supabase.rpc("request_approval", {
    p_kind: "edit_item", p_target_id: parsed.data.itemId, p_reason: parsed.data.reason ?? null,
    p_changes: { quantity_delta: -parsed.data.quantity },
  });
  if (error) return { ok: false, error: friendlyError(error, tr) };
  revalidatePath("/approvals");
  return { ok: true, message: tr("toasts.removalRequested") };
}

async function removeItemImpl(input: { itemId: string; reason?: string }): Promise<ActionResult> {
  const tr = await getTr();
  const parsed = z.object({ itemId: uuid, reason: z.string().max(500).optional() }).safeParse(input);
  if (!parsed.success) return { ok: false, error: tr("errors.invalidItem") };
  const profile = await getCurrentProfile();
  const supabase = await createClient();
  if (profile?.role === "owner") {
    const { error } = await supabase.from("items").update({ archived: true }).eq("id", parsed.data.itemId);
    if (error) return { ok: false, error: friendlyError(error, tr) };
    revalidateInventory();
    return { ok: true, message: tr("toasts.itemRemoved") };
  }
  const { error } = await supabase.rpc("request_approval", {
    p_kind: "archive_item", p_target_id: parsed.data.itemId, p_reason: parsed.data.reason ?? null,
  });
  if (error) return { ok: false, error: friendlyError(error, tr) };
  revalidatePath("/approvals");
  return { ok: true, message: tr("toasts.archiveRequested") };
}

async function restoreItemImpl(itemId: string): Promise<ActionResult> {
  const tr = await getTr();
  if (!uuid.safeParse(itemId).success) return { ok: false, error: tr("errors.invalidItem") };
  const supabase = await createClient();
  const { error } = await supabase.from("items").update({ archived: false }).eq("id", itemId);
  if (error) return { ok: false, error: friendlyError(error, tr) };
  revalidateInventory();
  return { ok: true, message: tr("toasts.itemRestored") };
}

// Failures are recorded in the developer error log (see src/lib/error-log.ts).
export const sellItem = logged("sellItem", sellItemImpl);
export const sellCart = logged("sellCart", sellCartImpl);
export const createItem = logged("createItem", createItemImpl);
export const createItems = logged("createItems", createItemsImpl);
export const saveItemEdit = logged("saveItemEdit", saveItemEditImpl);
export const saveProductEdit = logged("saveProductEdit", saveProductEditImpl);
export const addStock = logged("addStock", addStockImpl);
export const removeStock = logged("removeStock", removeStockImpl);
export const removeItem = logged("removeItem", removeItemImpl);
export const restoreItem = logged("restoreItem", restoreItemImpl);
