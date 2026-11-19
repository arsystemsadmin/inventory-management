"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireOwner } from "@/lib/auth";
import { friendlyError } from "@/lib/errors";
import type { ActionResult } from "@/lib/types";

function revalidateTime() {
  revalidatePath("/clock");
  revalidatePath("/payroll");
  revalidatePath("/dashboard");
  revalidatePath("/employees");
}

export async function clockIn(storeId: string): Promise<ActionResult> {
  if (!z.string().uuid().safeParse(storeId).success) return { ok: false, error: "Pick a store" };
  const supabase = await createClient();
  const { error } = await supabase.rpc("clock_in", { p_store_id: storeId });
  if (error) return { ok: false, error: friendlyError(error) };
  revalidateTime();
  return { ok: true, message: "Clocked in. Have a good shift!" };
}

export async function clockOut(): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("clock_out");
  if (error) return { ok: false, error: friendlyError(error) };
  revalidateTime();
  return { ok: true, message: "Clocked out" };
}

import { timeEntrySchema as entrySchema } from "@/lib/validation";

/** Owner adds or corrects a shift manually (RLS: owner-only writes). */
export async function saveTimeEntry(input: unknown): Promise<ActionResult> {
  const owner = await requireOwner();
  const parsed = entrySchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const { id, ...row } = parsed.data;
  const supabase = await createClient();
  const { error } = id
    ? await supabase.from("time_entries").update(row).eq("id", id)
    : await supabase.from("time_entries").insert({ ...row, business_id: owner.business_id });
  if (error) {
    if (error.code === "23505") return { ok: false, error: "This person already has an open shift. Close it first." };
    return { ok: false, error: friendlyError(error) };
  }
  revalidateTime();
  return { ok: true, message: id ? "Shift updated" : "Shift added" };
}

export async function deleteTimeEntry(id: string): Promise<ActionResult> {
  await requireOwner();
  if (!z.string().uuid().safeParse(id).success) return { ok: false, error: "Invalid shift" };
  const supabase = await createClient();
  const { error } = await supabase.from("time_entries").delete().eq("id", id);
  if (error) return { ok: false, error: friendlyError(error) };
  revalidateTime();
  return { ok: true, message: "Shift deleted" };
}
