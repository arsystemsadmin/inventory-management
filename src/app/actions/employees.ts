"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireOwner } from "@/lib/auth";
import { friendlyError } from "@/lib/errors";
import type { ActionResult } from "@/lib/types";

const rateCents = z.coerce.number().int().min(0).max(100_000);

const createSchema = z.object({
  full_name: z.string().trim().min(1, "Name is required").max(200),
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  password: z.string().min(8, "Temporary password must be at least 8 characters").max(72),
  hourly_rate_cents: rateCents,
  store_ids: z.array(z.string().uuid()).max(200).default([]),
});

export async function createEmployee(input: unknown): Promise<ActionResult> {
  const owner = await requireOwner();
  const parsed = createSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const v = parsed.data;

  // Service role ONLY for the auth admin call. business_id goes in
  // app_metadata (not user-editable); the DB trigger creates the profile.
  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.createUser({
    email: v.email,
    password: v.password,
    email_confirm: true,
    app_metadata: { business_id: owner.business_id, role: "employee" },
    user_metadata: { full_name: v.full_name },
  });
  if (error || !data.user) {
    return { ok: false, error: error?.message.includes("already") ? "A user with this email already exists." : "Could not create the user." };
  }

  // Everything else as the owner, through RLS.
  const supabase = await createClient();
  const id = data.user.id;

  // The DB trigger must have created an employee profile in *this* business
  // (RLS: the owner can only read their own business's profiles).
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", id).maybeSingle();
  if (!profile || profile.role !== "employee") {
    await admin.auth.admin.deleteUser(id);
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
  const parsed = z.object({
    profile_id: z.string().uuid(),
    full_name: z.string().trim().min(1).max(200),
    hourly_rate_cents: rateCents,
    store_ids: z.array(z.string().uuid()).max(200),
  }).safeParse(input);
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
  const admin = createAdminClient();
  const { error: banErr } = await admin.auth.admin.updateUserById(profileId, { ban_duration: active ? "none" : "876000h" });
  if (banErr) return { ok: false, error: "Saved, but could not update sign-in access." };
  revalidatePath("/employees");
  return { ok: true, message: active ? "Employee reactivated" : "Employee deactivated" };
}
