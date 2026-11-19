"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireOwner } from "@/lib/auth";
import { friendlyError } from "@/lib/errors";
import type { ActionResult } from "@/lib/types";

function revalidateSales() {
  revalidatePath("/sales");
  revalidatePath("/dashboard");
  revalidatePath("/inventory");
  revalidatePath("/stores", "layout");
  revalidatePath("/approvals");
}

export async function voidSale(saleId: string): Promise<ActionResult> {
  await requireOwner();
  if (!z.string().uuid().safeParse(saleId).success) return { ok: false, error: "Invalid sale" };
  const supabase = await createClient();
  const { error } = await supabase.rpc("void_sale", { p_sale_id: saleId });
  if (error) return { ok: false, error: friendlyError(error) };
  revalidateSales();
  return { ok: true, message: "Sale voided and stock restored" };
}

export async function requestVoid(saleId: string, reason?: string): Promise<ActionResult> {
  const parsed = z.object({ saleId: z.string().uuid(), reason: z.string().max(500).optional() }).safeParse({ saleId, reason });
  if (!parsed.success) return { ok: false, error: "Invalid sale" };
  const supabase = await createClient();
  const { error } = await supabase.rpc("request_approval", {
    p_kind: "void_sale", p_target_id: parsed.data.saleId, p_reason: parsed.data.reason ?? null,
  });
  if (error) return { ok: false, error: friendlyError(error) };
  revalidatePath("/approvals");
  return { ok: true, message: "Void request sent to the owner" };
}

export async function decideApproval(requestId: string, approve: boolean, note?: string): Promise<ActionResult> {
  await requireOwner();
  const parsed = z.object({ id: z.string().uuid(), note: z.string().max(500).optional() }).safeParse({ id: requestId, note });
  if (!parsed.success) return { ok: false, error: "Invalid request" };
  const supabase = await createClient();
  const { error } = await supabase.rpc("decide_approval", {
    p_request_id: parsed.data.id, p_approve: approve, p_note: parsed.data.note ?? null,
  });
  if (error) return { ok: false, error: friendlyError(error) };
  revalidateSales();
  return { ok: true, message: approve ? "Approved" : "Rejected" };
}
