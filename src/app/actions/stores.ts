"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireOwner } from "@/lib/auth";
import { friendlyError } from "@/lib/errors";
import type { ActionResult } from "@/lib/types";

import { storeSchema, storeToRow as toRow } from "@/lib/validation";
import { getTr } from "@/i18n/server";

export async function createStore(input: unknown): Promise<ActionResult<string>> {
  const tr = await getTr();
  const owner = await requireOwner();
  const parsed = storeSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: tr(parsed.error.issues[0].message) };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("stores")
    .insert({ ...toRow(parsed.data), business_id: owner.business_id })
    .select("id")
    .single();
  if (error) return { ok: false, error: friendlyError(error, tr) };
  revalidatePath("/stores");
  return { ok: true, data: data.id, message: tr("toasts.storeCreated") };
}

export async function updateStore(storeId: string, input: unknown): Promise<ActionResult> {
  const tr = await getTr();
  await requireOwner();
  const parsed = storeSchema.safeParse(input);
  if (!parsed.success || !z.string().uuid().safeParse(storeId).success) {
    return { ok: false, error: (parsed.error ? tr(parsed.error.issues[0].message) : undefined) ?? tr("errors.invalidStore") };
  }
  const supabase = await createClient();
  const { error } = await supabase.from("stores").update(toRow(parsed.data)).eq("id", storeId);
  if (error) return { ok: false, error: friendlyError(error, tr) };
  revalidatePath("/stores", "layout");
  return { ok: true, message: tr("toasts.storeUpdated") };
}

export async function finishSetup(storeId: string): Promise<ActionResult> {
  const tr = await getTr();
  if (!z.string().uuid().safeParse(storeId).success) return { ok: false, error: tr("errors.invalidStore") };
  const supabase = await createClient();
  const { error } = await supabase.rpc("finish_store_setup", { p_store_id: storeId });
  if (error) return { ok: false, error: friendlyError(error, tr) };
  revalidatePath("/stores", "layout");
  return { ok: true, message: tr("toasts.setupFinished") };
}

export async function reopenSetup(storeId: string): Promise<ActionResult> {
  const tr = await getTr();
  await requireOwner();
  const supabase = await createClient();
  const { error } = await supabase
    .from("stores").update({ inventory_locked_at: null, inventory_locked_by: null }).eq("id", storeId);
  if (error) return { ok: false, error: friendlyError(error, tr) };
  revalidatePath("/stores", "layout");
  return { ok: true, message: tr("toasts.setupReopened") };
}

export async function setStoreMembers(storeId: string, profileIds: string[]): Promise<ActionResult> {
  const tr = await getTr();
  const owner = await requireOwner();
  const parsed = z.object({ storeId: z.string().uuid(), ids: z.array(z.string().uuid()).max(500) })
    .safeParse({ storeId, ids: profileIds });
  if (!parsed.success) return { ok: false, error: tr("errors.invalidSelection") };
  const supabase = await createClient();
  const { data: current } = await supabase.from("store_members").select("profile_id").eq("store_id", storeId);
  const have = new Set((current ?? []).map((r) => r.profile_id));
  const want = new Set(parsed.data.ids);
  const toAdd = [...want].filter((id) => !have.has(id));
  const toRemove = [...have].filter((id) => !want.has(id));
  if (toRemove.length) {
    const { error } = await supabase.from("store_members").delete().eq("store_id", storeId).in("profile_id", toRemove);
    if (error) return { ok: false, error: friendlyError(error, tr) };
  }
  if (toAdd.length) {
    const { error } = await supabase.from("store_members")
      .insert(toAdd.map((profile_id) => ({ store_id: storeId, profile_id, business_id: owner.business_id })));
    if (error) return { ok: false, error: friendlyError(error, tr) };
  }
  revalidatePath("/stores", "layout");
  revalidatePath("/employees");
  return { ok: true, message: tr("toasts.staffUpdated") };
}
