"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { ADMIN_KEY_MISSING, createAdminClient } from "@/lib/supabase/admin";
import { requireOwner } from "@/lib/auth";
import { friendlyError } from "@/lib/errors";
import type { ActionResult } from "@/lib/types";

import { createEmployeeSchema as createSchema, updateEmployeeSchema } from "@/lib/validation";

export async function createEmployee(input: unknown): Promise<ActionResult> {
  const owner = await requireOwner();
  const parsed = createSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const v = parsed.data;

  // Service role ONLY for the auth admin call. business_id goes in
  // app_metadata (not user-editable); the DB trigger creates the profile.
  const admin = await createAdminClient();
  if (!admin) return { ok: false, error: ADMIN_KEY_MISSING };
  let data, error;
  try {
    ({ data, error } = await admin.auth.admin.createUser({
      email: v.email,
      password: v.password,
      email_confirm: true,
      app_metadata: { business_id: owner.business_id, role: "employee" },
      user_metadata: { full_name: v.full_name },
    }));
  } catch (e) {
    console.error("createUser failed", e);
    return { ok: false, error: "Couldn't reach the sign-in service. Please try again." };
  }
  if (error || !data?.user) {
    if (error?.message.toLowerCase().includes("already")) return { ok: false, error: "A user with this email already exists." };
    console.error("createUser error", error);
    // Owner-only screen: show the reason (e.g. an invalid secret key) so it can be fixed.
    return { ok: false, error: `Could not create the user${error?.message ? `: ${error.message}` : "."}` };
  }

  // Everything else as the owner, through RLS.
  const supabase = await createClient();
  const id = data.user.id;

  // The DB trigger must have created an employee profile in *this* business
  // (RLS: the owner can only read their own business's profiles).
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", id).maybeSingle();
  if (!profile || profile.role !== "employee") {
    await admin.auth.admin.deleteUser(id).catch(() => undefined);
    return { ok: false, error: "Could not set up the employee profile. Nothing was saved." };
  }
  const { error: payErr } = await supabase.from("employee_pay")
    .insert({ profile_id: id, business_id: owner.business_id, hourly_rate_cents: v.hourly_rate_cents });
  if (payErr) return { ok: false, error: friendlyError(payErr) };
  if (v.store_ids.length) {
    const { error: memErr } = await supabase.from("store_members")
      .insert(v.store_ids.map((store_id) => ({ store_id, profile_id: id, business_id: owner.business_id })));
    if (memErr) return { ok: false, error: friendlyError(memErr) };
  }
  revalidatePath("/employees");
  return { ok: true, message: `${v.full_name} can now sign in with ${v.email}` };
}

export async function updateEmployee(input: unknown): Promise<ActionResult> {
  const owner = await requireOwner();
  const parsed = updateEmployeeSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const v = parsed.data;
  const supabase = await createClient();

  const { error: nameErr } = await supabase.from("profiles").update({ full_name: v.full_name }).eq("id", v.profile_id);
  if (nameErr) return { ok: false, error: friendlyError(nameErr) };
  // Changing the rate never rewrites history: shifts keep their snapshot.
  const { error: payErr } = await supabase.from("employee_pay")
    .upsert({ profile_id: v.profile_id, business_id: owner.business_id, hourly_rate_cents: v.hourly_rate_cents });
  if (payErr) return { ok: false, error: friendlyError(payErr) };

  const { data: current } = await supabase.from("store_members").select("store_id").eq("profile_id", v.profile_id);
  const have = new Set((current ?? []).map((r) => r.store_id));
  const want = new Set(v.store_ids);
  const add = [...want].filter((s) => !have.has(s));
  const remove = [...have].filter((s) => !want.has(s));
  if (remove.length) {
    const { error } = await supabase.from("store_members").delete().eq("profile_id", v.profile_id).in("store_id", remove);
    if (error) return { ok: false, error: friendlyError(error) };
  }
  if (add.length) {
    const { error } = await supabase.from("store_members")
      .insert(add.map((store_id) => ({ store_id, profile_id: v.profile_id, business_id: owner.business_id })));
    if (error) return { ok: false, error: friendlyError(error) };
  }
  revalidatePath("/employees");
  revalidatePath("/stores", "layout");
  return { ok: true, message: "Employee updated" };
}

export async function setEmployeeActive(profileId: string, active: boolean): Promise<ActionResult> {
  await requireOwner();
  if (!z.string().uuid().safeParse(profileId).success) return { ok: false, error: "Invalid employee" };
  const supabase = await createClient();
  // RLS guarantees this only matches an employee in the owner's business.
  const { data, error } = await supabase.from("profiles").update({ active })
    .eq("id", profileId).eq("role", "employee").select("id");
  if (error) return { ok: false, error: friendlyError(error) };
  if (!data?.length) return { ok: false, error: "Employee not found." };

  // Deactivated users get no data via RLS already; also block sign-in.
  const admin = await createAdminClient();
  if (!admin) return { ok: false, error: `Saved, but sign-in access wasn't changed. ${ADMIN_KEY_MISSING}` };
  const { error: banErr } = await admin.auth.admin
    .updateUserById(profileId, { ban_duration: active ? "none" : "876000h" })
    .catch((e: unknown) => ({ error: e instanceof Error ? e : new Error(String(e)) }));
  if (banErr) {
    console.error("ban update failed", banErr);
    return { ok: false, error: `Saved, but could not update sign-in access: ${banErr.message}` };
  }
  revalidatePath("/employees");
  return { ok: true, message: active ? "Employee reactivated" : "Employee deactivated" };
}
