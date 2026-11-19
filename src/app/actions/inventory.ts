"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { friendlyError } from "@/lib/errors";
import type { ActionResult, SellResult } from "@/lib/types";

import { itemFields, newItemSchema, qty, uuid } from "@/lib/validation";

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
  const supabase = await createClient();
  // business_id is filled by trigger from the store; RLS checks membership.
  const { error } = await supabase.from("items").insert(parsed.data);
  if (error) return { ok: false, error: friendlyError(error) };
  revalidateInventory();
  return { ok: true, message: "Item added" };
}

export async function saveItemEdit(input: { itemId: string; changes: unknown; reason?: string }): Promise<ActionResult> {
  const id = uuid.safeParse(input.itemId);
  const changes = itemFields.partial().safeParse(input.changes);
  if (!id.success || !changes.success) return { ok: false, error: changes.error?.issues[0].message ?? "Invalid item" };
  const diff = Object.fromEntries(Object.entries(changes.data).filter(([, v]) => v !== undefined));
  if (Object.keys(diff).length === 0) return { ok: false, error: "Nothing changed." };

  const supabase = await createClient();
  const { data: item } = await supabase.from("items").select("store_id").eq("id", id.data).single();
  if (!item) return { ok: false, error: "Item not found." };

  if (await canEditDirectly(item.store_id)) {
    const { error } = await supabase.from("items").update(diff).eq("id", id.data);
    if (error) return { ok: false, error: friendlyError(error) };
    revalidateInventory();
    return { ok: true, message: "Item updated" };
  }
  const { error } = await supabase.rpc("request_approval", {
    p_kind: "edit_item", p_target_id: id.data, p_reason: input.reason ?? null, p_changes: diff,
  });
  if (error) return { ok: false, error: friendlyError(error) };
  revalidatePath("/approvals");
  return { ok: true, message: "Edit sent to the owner for approval" };
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
