import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * Reads the secret (service-role) key. On Cloudflare Workers, secrets are
 * usually mirrored into process.env by OpenNext; fall back to the Worker's
 * env bindings in case they aren't.
 */
async function serviceRoleKey(): Promise<string | undefined> {
  const fromProcess = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (fromProcess) return fromProcess;
  try {
    const { getCloudflareContext } = await import("@opennextjs/cloudflare");
    const { env } = await getCloudflareContext({ async: true });
    const v = (env as unknown as Record<string, unknown>).SUPABASE_SERVICE_ROLE_KEY;
    return typeof v === "string" && v ? v : undefined;
  } catch {
    return undefined; // not running on Workers (local dev)
  }
}

/**
 * Service-role client. BYPASSES RLS. Server-only (the "server-only" import
 * makes any client-side import a build error). Use exclusively for auth admin
 * operations (creating / banning users); do all data writes with the user's
 * own client so RLS still applies. Returns null when the key isn't configured.
 */
export async function createAdminClient() {
  const key = await serviceRoleKey();
  if (!key) return null;
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export const ADMIN_KEY_MISSING =
  "Employee accounts can't be managed yet: the server's secret key isn't set. In Cloudflare, add a runtime Secret named SUPABASE_SERVICE_ROLE_KEY (your Supabase sb_secret_… key), then redeploy.";
