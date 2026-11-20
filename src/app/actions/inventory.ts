"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { friendlyError } from "@/lib/errors";
import type { ActionResult, SellResult } from "@/lib/types";

import { itemFields, newItemSchema, newItemsSchema, qty, STORAGE_IMAGE_PATH, uuid } from "@/lib/validation";

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

export async function sellItem(input: { itemId: string; quantity: number }): Promise<ActionResult<SellResult>> {
  const parsed = z.object({ itemId: uuid, quantity: qty }).safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("sell_item", { p_item_id: parsed.data.itemId, p_qty: parsed.data.quantity });
  if (error) return { ok: false, error: friendlyError(error) };
  revalidateInventory();
  revalidatePath("/sales");
  return { ok: true, data: data as SellResult };
}

export async function createItem(input: unknown): Promise<ActionResult> {
  const parsed = newItemSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  if (badImage(parsed.data.image_path) || badImage(parsed.data.variant_image_path) || badImage(parsed.data.variation_image_path)) {
    return { ok: false, error: "Invalid photo." };
  }
  const supabase = await createClient();
  // business_id is filled by trigger from the store; RLS checks membership.
  const { variation_image_path, ...row } = parsed.data;
  const { error } = await supabase.from("items").insert(variation_image_path ? { ...row, variation_image_path } : row);
  if (error) return { ok: false, error: friendlyError(error) };
  revalidateInventory();
  return { ok: true, message: "Item added" };
}

/** Creates several variants (e.g. one per size) in a single insert, so it's all-or-nothing. */
export async function createItems(input: unknown): Promise<ActionResult<number>> {
  const parsed = newItemsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  if (parsed.data.some((r) => badImage(r.image_path) || badImage(r.variant_image_path) || badImage(r.variation_image_path))) {
    return { ok: false, error: "Invalid photo." };
  }
  const supabase = await createClient();
  // Only send the variation photo when set, so inserts work even before the
  // variation_image_path column exists (migration 20261120000010).
  const rows = parsed.data.map(({ variation_image_path, ...r }) => (variation_image_path ? { ...r, variation_image_path } : r));
  const { error } = await supabase.from("items").insert(rows);
  if (error) return { ok: false, error: friendlyError(error) };
  revalidateInventory();
  return { ok: true, data: parsed.data.length, message: `Added ${parsed.data.length} item${parsed.data.length === 1 ? "" : "s"}` };
}

export async function saveItemEdit(input: { itemId: string; changes: unknown; reason?: string }): Promise<ActionResult<"applied" | "requested">> {
  const id = uuid.safeParse(input.itemId);
  const changes = itemFields.partial().safeParse(input.changes);
  if (!id.success || !changes.success) return { ok: false, error: changes.error?.issues[0].message ?? "Invalid item" };
  const { image_path, variant_image_path, variation_image_path, ...rest } = changes.data;
  const diff = Object.fromEntries(Object.entries(rest).filter(([, v]) => v !== undefined));
  const raw = input.changes as object;
  const photo: { image_path?: string | null; variant_image_path?: string | null; variation_image_path?: string | null } = {};
  if ("image_path" in raw) photo.image_path = image_path ?? null;
  if ("variant_image_path" in raw) photo.variant_image_path = variant_image_path ?? null;
  if ("variation_image_path" in raw) photo.variation_image_path = variation_image_path ?? null;
  const imageChanged = Object.keys(photo).length > 0;
  if (Object.keys(diff).length === 0 && !imageChanged) return { ok: false, error: "Nothing changed." };
  if (badImage(photo.image_path) || badImage(photo.variant_image_path) || badImage(photo.variation_image_path)) {
    return { ok: false, error: "Invalid photo." };
  }

  const supabase = await createClient();
  const { data: item } = await supabase.from("items").select("store_id").eq("id", id.data).single();
  if (!item) return { ok: false, error: "Item not found." };

  // Photos never need approval (they don't change stock or price).
  if (imageChanged) {
    const { error } = await supabase.from("items").update(photo).eq("id", id.data);
    if (error) return { ok: false, error: friendlyError(error) };
    if (Object.keys(diff).length === 0) {
      revalidateInventory();
      const added = Object.values(photo).some(Boolean);
      return { ok: true, data: "applied", message: added ? "Photo updated" : "Photo removed" };
    }
  }

  if (await canEditDirectly(item.store_id)) {
    const { error } = await supabase.from("items").update(diff).eq("id", id.data);
    if (error) return { ok: false, error: friendlyError(error) };
    revalidateInventory();
    return { ok: true, data: "applied", message: "Item updated" };
  }
  const { error } = await supabase.rpc("request_approval", {
    p_kind: "edit_item", p_target_id: id.data, p_reason: input.reason ?? null, p_changes: diff,
  });
  if (error) return { ok: false, error: friendlyError(error) };
  revalidatePath("/approvals");
  return { ok: true, data: "requested", message: "Edit sent to the owner for approval" };
}

/**
 * Edits a whole product: applies the same changes (name, category, photo,
 * price…) to every variation. Each variation goes through saveItemEdit, so
 * setup-lock approval rules apply exactly as for single edits.
 */
export async function saveProductEdit(input: { storeId: string; name: string; changes: unknown; reason?: string }): Promise<ActionResult> {
  const parsed = z.object({ storeId: uuid, name: z.string().trim().min(1).max(200) }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid product" };
  const supabase = await createClient();
  const { data } = await supabase.from("items").select("id, name").eq("store_id", parsed.data.storeId).eq("archived", false);
  const ids = (data ?? []).filter((r) => r.name.trim().toLowerCase() === parsed.data.name.toLowerCase()).map((r) => r.id);
  if (!ids.length) return { ok: false, error: "Product not found." };
  let requested = false;
  for (const itemId of ids) {
    const res = await saveItemEdit({ itemId, changes: input.changes, reason: input.reason });
    if (!res.ok) return res;
    if (res.data === "requested") requested = true;
  }
  return { ok: true, message: requested ? "Changes sent to the owner for approval" : "Product updated" };
}

export async function addStock(input: { itemId: string; quantity: number }): Promise<ActionResult<number>> {
  const parsed = z.object({ itemId: uuid, quantity: qty }).safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("add_stock", { p_item_id: parsed.data.itemId, p_qty: parsed.data.quantity });
  if (error) return { ok: false, error: friendlyError(error) };
  revalidateInventory();
  return { ok: true, data: data as number, message: `Added ${parsed.data.quantity} to stock` };
}

export async function removeStock(input: { itemId: string; quantity: number; reason?: string }): Promise<ActionResult> {
  const parsed = z.object({ itemId: uuid, quantity: qty, reason: z.string().max(500).optional() }).safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const supabase = await createClient();
  const { data: item } = await supabase.from("items").select("store_id").eq("id", parsed.data.itemId).single();
  if (!item) return { ok: false, error: "Item not found." };

  if (await canEditDirectly(item.store_id)) {
    const { error } = await supabase.rpc("remove_stock", { p_item_id: parsed.data.itemId, p_qty: parsed.data.quantity });
    if (error) return { ok: false, error: friendlyError(error) };
    revalidateInventory();
    return { ok: true, message: `Removed ${parsed.data.quantity} from stock` };
  }
  const { error } = await supabase.rpc("request_approval", {
    p_kind: "edit_item", p_target_id: parsed.data.itemId, p_reason: parsed.data.reason ?? null,
    p_changes: { quantity_delta: -parsed.data.quantity },
  });
  if (error) return { ok: false, error: friendlyError(error) };
  revalidatePath("/approvals");
  return { ok: true, message: "Stock removal sent to the owner for approval" };
}

export async function removeItem(input: { itemId: string; reason?: string }): Promise<ActionResult> {
  const parsed = z.object({ itemId: uuid, reason: z.string().max(500).optional() }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid item" };
  const profile = await getCurrentProfile();
  const supabase = await createClient();
  if (profile?.role === "owner") {
    const { error } = await supabase.from("items").update({ archived: true }).eq("id", parsed.data.itemId);
    if (error) return { ok: false, error: friendlyError(error) };
    revalidateInventory();
    return { ok: true, message: "Item removed" };
  }
  const { error } = await supabase.rpc("request_approval", {
    p_kind: "archive_item", p_target_id: parsed.data.itemId, p_reason: parsed.data.reason ?? null,
  });
  if (error) return { ok: false, error: friendlyError(error) };
  revalidatePath("/approvals");
  return { ok: true, message: "Removal sent to the owner for approval" };
}

export async function restoreItem(itemId: string): Promise<ActionResult> {
  if (!uuid.safeParse(itemId).success) return { ok: false, error: "Invalid item" };
  const supabase = await createClient();
  const { error } = await supabase.from("items").update({ archived: false }).eq("id", itemId);
  if (error) return { ok: false, error: friendlyError(error) };
  revalidateInventory();
  return { ok: true, message: "Item restored" };
}
