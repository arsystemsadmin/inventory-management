import "server-only";
import { AsyncLocalStorage } from "node:async_hooks";
import { headers } from "next/headers";
import { unstable_rethrow } from "next/navigation";
import { setRawErrorSink } from "@/lib/errors";
import { createAdminClient } from "@/lib/supabase/admin";
import { supabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

/**
 * Developer-only error log (table public.error_log, unreadable by app users).
 * Server actions are wrapped with logged(): when one returns an error (or
 * throws), we record who, where, what they saw and the raw error behind it.
 */

type Store = { raw: unknown[] };
const als = new AsyncLocalStorage<Store>();
setRawErrorSink((err) => als.getStore()?.raw.push(err));

const SECRET_KEY = /pass|token|secret|apikey|api_key|authorization/i;

/** Copy of a value that's safe and small enough to store. */
function redact(v: unknown, depth = 0): unknown {
  if (depth > 5) return "[…]";
  if (v == null || typeof v === "number" || typeof v === "boolean") return v;
  if (typeof v === "string") {
    if (v.startsWith("data:")) return "[image]";
    return v.length > 500 ? `${v.slice(0, 500)}…` : v;
  }
  if (v instanceof Error) return { name: v.name, message: v.message };
  if (Array.isArray(v)) return v.slice(0, 50).map((x) => redact(x, depth + 1));
  if (typeof v === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, val] of Object.entries(v as Record<string, unknown>).slice(0, 50)) {
      out[k] = SECRET_KEY.test(k) ? "[redacted]" : redact(val, depth + 1);
    }
    return out;
  }
  return String(v);
}

function codeOf(raw: unknown[]): string | null {
  for (const e of raw) {
    const r = e as { code?: string; message?: string };
    if (r?.message && /^[A-Z_]{4,}$/.test(r.message)) return r.message; // our SQL error codes
    if (r?.code) return String(r.code);
  }
  return null;
}

export async function logError(entry: {
  action: string; message: string; code?: string | null; details?: unknown; source?: "server" | "client";
}) {
  if (!supabaseConfigured) return; // browser demo mode has no database
  try {
    const admin = await createAdminClient();
    if (!admin) return;
    let user: { id: string; email?: string } | null = null;
    let profile: { business_id: string; role: string } | null = null;
    try {
      const { data } = await (await createClient()).auth.getUser();
      user = data.user;
      if (user) {
        const { data: p } = await admin.from("profiles").select("business_id, role").eq("id", user.id).maybeSingle();
        profile = p;
      }
    } catch { /* not signed in */ }
    const h = await headers();
    let path: string | null = null;
    try { path = h.get("referer") ? new URL(h.get("referer")!).pathname : null; } catch { /* ignore */ }
    const { error } = await admin.from("error_log").insert({
      business_id: profile?.business_id ?? null,
      user_id: user?.id ?? null,
      user_email: user?.email ?? null,
      user_role: profile?.role ?? null,
      source: entry.source ?? "server",
      action: entry.action.slice(0, 100),
      path: path?.slice(0, 500) ?? null,
      message: entry.message.slice(0, 2000),
      code: entry.code?.slice(0, 100) ?? null,
      details: entry.details ?? null,
      user_agent: h.get("user-agent")?.slice(0, 400) ?? null,
    });
    if (error) console.error("error_log insert failed", error);
  } catch (e) {
    console.error("error_log failed", e); // logging must never break the app
  }
}

/** Wraps a server action so failures are logged. Pass logInput: false for actions with sensitive input. */
export function logged<A extends unknown[], R>(
  action: string, fn: (...args: A) => Promise<R>, opts: { logInput?: boolean } = {},
): (...args: A) => Promise<R> {
  return async (...args: A): Promise<R> => {
    const store: Store = { raw: [] };
    const input = opts.logInput === false ? undefined : redact(args);
    try {
      const result = await als.run(store, () => fn(...args));
      const r = result as { ok?: boolean; error?: unknown } | null | undefined;
      if (r && typeof r === "object" && typeof r.error === "string" && r.ok !== true) {
        await logError({ action, message: r.error, code: codeOf(store.raw), details: { input, raw: redact(store.raw) } });
      }
      return result;
    } catch (e) {
      unstable_rethrow(e); // redirects / notFound aren't errors
      await logError({
        action, message: e instanceof Error ? e.message : String(e), code: "EXCEPTION",
        details: { input, raw: redact(store.raw), stack: e instanceof Error ? e.stack?.slice(0, 4000) : undefined },
      });
      throw e;
    }
  };
}
