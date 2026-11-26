import "server-only";
import { createClient } from "@supabase/supabase-js";
import { getTr } from "@/i18n/server";

const KEY_NAMES = ["SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_SECRET_KEY"];

async function workerEnv(): Promise<Record<string, unknown>> {
  try {
    const { getCloudflareContext } = await import("@opennextjs/cloudflare");
    const { env } = await getCloudflareContext({ async: true });
    return env as unknown as Record<string, unknown>;
  } catch {
    return {}; // not running on Workers (local dev)
  }
}

/**
 * Reads the secret (service-role) key. On Cloudflare Workers, secrets are
 * usually mirrored into process.env by OpenNext; fall back to the Worker's
 * env bindings in case they aren't. Accepts either name Supabase uses.
 */
async function serviceRoleKey(): Promise<string | undefined> {
  for (const name of KEY_NAMES) {
    const v = process.env[name];
    if (v) return v;
  }
  const env = await workerEnv();
  for (const name of KEY_NAMES) {
    const v = env[name];
    if (typeof v === "string" && v) return v;
  }
  return undefined;
}

/** Names (never values) of Supabase-related settings the running app can see, for diagnosing setup. */
export async function visibleSupabaseSettingNames(): Promise<string[]> {
  const env = await workerEnv();
  const names = new Set([...Object.keys(process.env), ...Object.keys(env)].filter((n) => /supabase/i.test(n)));
  return [...names].sort();
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

export async function adminKeyMissingMessage() {
  const [seen, tr] = await Promise.all([visibleSupabaseSettingNames(), getTr()]);
  return tr("errors.adminKeyMissing", { names: seen.length ? seen.join(", ") : tr("errors.none") });
}
