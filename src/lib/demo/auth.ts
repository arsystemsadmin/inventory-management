"use client";

import { loginSchema, signupSchema } from "@/lib/validation";
import { tClient as tr } from "@/i18n/client";
import { seedSampleData } from "./seed";
import { commit, getState, hashPassword, newId, setSessionUser } from "./store";

type Result = { error?: string };

export async function demoSignup(form: FormData): Promise<Result> {
  const parsed = signupSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: tr(parsed.error.issues[0].message) };
  const v = parsed.data;
  const email = v.email.toLowerCase();
  if (getState().users.some((u) => u.email === email)) return { error: tr("errors.demoEmailTaken") };
  const [ownerHash, sampleHash] = await Promise.all([hashPassword(v.password), hashPassword("password123")]);
  const withSample = form.get("sample") === "on";

  const ownerId = commit((s) => {
    const now = new Date().toISOString();
    const businessId = newId();
    const id = newId();
    s.businesses.push({ id: businessId, name: v.business_name, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone, created_at: now });
    s.users.push({ id, business_id: businessId, full_name: v.full_name, email, role: "owner", active: true, password_hash: ownerHash, created_at: now });
    if (withSample) seedSampleData(s, id, sampleHash);
    return id;
  });
  setSessionUser(ownerId);
  return {};
}

export async function demoLogin(form: FormData): Promise<Result> {
  const parsed = loginSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: tr(parsed.error.issues[0].message) };
  const user = getState().users.find((u) => u.email === parsed.data.email.toLowerCase());
  if (!user || user.password_hash !== (await hashPassword(parsed.data.password))) return { error: tr("errors.INVALID_CREDENTIALS") };
  if (!user.active) return { error: tr("errors.ACCOUNT_INACTIVE") };
  setSessionUser(user.id);
  return {};
}

/** Accounts saved in this browser, for one-tap sign-in on the demo login page. */
export function demoAccounts() {
  const s = getState();
  return s.users.map((u) => ({
    email: u.email, name: u.full_name, role: u.role, active: u.active,
    business: s.businesses.find((b) => b.id === u.business_id)?.name ?? "",
  }));
}
