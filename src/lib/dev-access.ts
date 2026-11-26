import "server-only";
import { readServerEnv } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/**
 * Developer access: the signed-in user's email must be listed in the
 * DEV_EMAILS setting (comma-separated) on the Cloudflare Worker.
 * Returns the developer's email, or null for everyone else.
 */
export async function getDeveloperEmail(): Promise<string | null> {
  const list = ((await readServerEnv("DEV_EMAILS")) ?? "")
    .split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);
  if (!list.length) return null;
  const { data } = await (await createClient()).auth.getUser();
  const email = data.user?.email?.toLowerCase();
  return email && list.includes(email) ? email : null;
}
