"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { NOT_CONNECTED_MESSAGE, supabaseConfigured } from "@/lib/supabase/config";

export type AuthFormState = { error?: string; message?: string } | undefined;

import { loginSchema, signupSchema } from "@/lib/validation";

function safeNext(next: string | undefined) {
  // Only allow same-site relative paths (no "//evil.com" open redirects).
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
}

export async function login(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  if (!supabaseConfigured) return { error: NOT_CONNECTED_MESSAGE };
  const parsed = loginSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });
  if (error) {
    return { error: error.message.includes("banned") ? "This account has been deactivated." : "Invalid email or password." };
  }
  redirect(safeNext(parsed.data.next));
}

export async function signup(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  if (!supabaseConfigured) return { error: NOT_CONNECTED_MESSAGE };
  const parsed = signupSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  // The on_auth_user_created trigger creates the business + owner profile
  // in the same transaction as the auth user.
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: { data: { full_name: parsed.data.full_name, business_name: parsed.data.business_name } },
  });
  if (error) return { error: error.message };
  if (!data.session) {
    return { message: "Check your email to confirm your account, then sign in." };
  }
  redirect("/");
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
