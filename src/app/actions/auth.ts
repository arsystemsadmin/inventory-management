"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { supabaseConfigured } from "@/lib/supabase/config";

export type AuthFormState = { error?: string; message?: string } | undefined;

import { loginSchema, signupSchema } from "@/lib/validation";
import { getTr } from "@/i18n/server";
import { logged } from "@/lib/error-log";

function safeNext(next: string | undefined) {
  // Only allow same-site relative paths (no "//evil.com" open redirects).
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/app";
}

async function loginImpl(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const tr = await getTr();
  if (!supabaseConfigured) return { error: tr("demo.notConnected") };
  const parsed = loginSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: tr(parsed.error.issues[0].message) };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });
  if (error) {
    return { error: error.message.includes("banned") ? tr("errors.ACCOUNT_INACTIVE") : tr("errors.INVALID_CREDENTIALS") };
  }
  redirect(safeNext(parsed.data.next));
}

async function signupImpl(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const tr = await getTr();
  if (!supabaseConfigured) return { error: tr("demo.notConnected") };
  const parsed = signupSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: tr(parsed.error.issues[0].message) };

  const supabase = await createClient();
  const h = await headers();
  const origin = h.get("origin") ?? `https://${h.get("host")}`;
  // The on_auth_user_created trigger creates the business + owner profile
  // in the same transaction as the auth user.
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { full_name: parsed.data.full_name, business_name: parsed.data.business_name },
      emailRedirectTo: `${origin}/auth/callback`,
    },
  });
  if (error) return { error: error.message };
  if (!data.session) {
    return { message: tr("auth.checkEmail") };
  }
  redirect("/app");
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

// Failures are recorded in the developer error log (see src/lib/error-log.ts).
export const login = logged("login", loginImpl, { logInput: false });
export const signup = logged("signup", signupImpl, { logInput: false });
