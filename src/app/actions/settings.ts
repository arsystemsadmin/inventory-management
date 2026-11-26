"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { friendlyError } from "@/lib/errors";
import { settingsSchema } from "@/lib/validation";
import type { ActionResult } from "@/lib/types";
import { getTr } from "@/i18n/server";
import { logged } from "@/lib/error-log";

async function updateMySettingsImpl(input: unknown): Promise<ActionResult> {
  const tr = await getTr();
  const profile = await requireProfile();
  const parsed = settingsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: tr(parsed.error.issues[0].message) };
  const v = parsed.data;
  const supabase = await createClient();

  // Own name + default store only; checked in the database function.
  const { error } = await supabase.rpc("update_my_settings", {
    p_full_name: v.full_name, p_default_store_id: v.default_store_id,
  });
  if (error) return { ok: false, error: friendlyError(error, tr) };

  if (profile.role === "owner" && v.business_name) {
    const { error: bErr } = await supabase.from("businesses").update({ name: v.business_name }).eq("id", profile.business_id);
    if (bErr) return { ok: false, error: friendlyError(bErr, tr) };
  }
  revalidatePath("/", "layout");
  return { ok: true, message: tr("toasts.settingsSaved") };
}

export const updateMySettings = logged("updateMySettings", updateMySettingsImpl);
