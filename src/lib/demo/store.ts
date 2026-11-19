"use client";

/**
 * Browser-only demo backend used while Supabase isn't configured.
 * All data lives in localStorage (shared by tabs of this browser). The signed-in
 * user is kept per tab in sessionStorage (falling back to the last sign-in), so
 * the owner and an employee can be open side by side in two tabs.
 */
import { useSyncExternalStore } from "react";
import type { Item, Profile, Sale, Store } from "@/lib/types";

export const DATA_KEY = "binventory-demo-v1";
const SESSION_KEY = "binventory-demo-session";

export type DemoUser = Profile & { password_hash: string; created_at: string };
export type DemoBusiness = { id: string; name: string; timezone: string; created_at: string };
export type DemoPay = { profile_id: string; business_id: string; hourly_rate_cents: number; updated_at: string };
export type DemoStore = Store & { inventory_locked_by: string | null };
export type DemoMember = { store_id: string; profile_id: string; business_id: string };
export type DemoItem = Omit<Item, "stock_status"> & { created_at: string; created_by: string | null; updated_by: string | null };
export type DemoSale = Sale & { business_id: string; voided_by: string | null };
export type DemoMovement = {
  id: string; business_id: string; store_id: string; item_id: string; delta: number; quantity_after: number;
  reason: "initial" | "restock" | "edit" | "sale" | "void"; sale_id: string | null; actor_id: string | null; created_at: string;
};
export type DemoShift = {
  id: string; business_id: string; store_id: string; profile_id: string; clock_in: string; clock_out: string | null;
  hourly_rate_cents_snapshot: number; note: string | null; edited_by: string | null;
};
export type DemoApproval = {
  id: string; business_id: string; store_id: string; kind: "archive_item" | "void_sale" | "edit_item";
  item_id: string | null; sale_id: string | null; changes: Record<string, string | number | null> | null;
  reason: string | null; status: "pending" | "approved" | "rejected"; requested_by: string; requested_at: string;
  decided_by: string | null; decided_at: string | null; decision_note: string | null;
};

export type DemoState = {
  v: 1;
  businesses: DemoBusiness[];
  users: DemoUser[];
  pay: DemoPay[];
  stores: DemoStore[];
  members: DemoMember[];
  items: DemoItem[];
  sales: DemoSale[];
  movements: DemoMovement[];
  shifts: DemoShift[];
  approvals: DemoApproval[];
};

export const emptyState = (): DemoState => ({
  v: 1, businesses: [], users: [], pay: [], stores: [], members: [], items: [], sales: [], movements: [], shifts: [], approvals: [],
});

export type Snapshot = { state: DemoState; userId: string | null; now: number };

let state: DemoState | null = null;
let userId: string | null | undefined;
let snapshot: Snapshot | null = null;
const listeners = new Set<() => void>();

function loadState(): DemoState {
  try {
    const raw = window.localStorage.getItem(DATA_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as DemoState;
      if (parsed?.v === 1) return { ...emptyState(), ...parsed };
    }
  } catch { /* storage blocked or corrupt: start fresh */ }
  return emptyState();
}

function loadSession(): string | null {
  try {
    return window.sessionStorage.getItem(SESSION_KEY) ?? window.localStorage.getItem(SESSION_KEY);
  } catch {
    return null;
  }
}

function emit() {
  snapshot = null;
  listeners.forEach((l) => l());
}

export function getState(): DemoState {
  if (!state) state = loadState();
  return state;
}

export function getUserId(): string | null {
  if (userId === undefined) userId = loadSession();
  return userId;
}

/** Apply a change to a deep copy and persist it (all-or-nothing, like a transaction). */
export function commit<T>(fn: (draft: DemoState) => T): T {
  const draft = structuredClone(getState());
  const result = fn(draft);
  state = draft;
  try { window.localStorage.setItem(DATA_KEY, JSON.stringify(draft)); } catch { /* quota/private mode */ }
  emit();
  return result;
}

export function setSessionUser(id: string | null) {
  userId = id;
  try {
    if (id) {
      window.sessionStorage.setItem(SESSION_KEY, id);
      window.localStorage.setItem(SESSION_KEY, id);
    } else {
      window.sessionStorage.removeItem(SESSION_KEY);
      window.localStorage.removeItem(SESSION_KEY);
    }
  } catch { /* ignore */ }
  emit();
}

/** Force a re-render with a fresh clock (used for the 30-minute pay refresh). */
export function tick() { emit(); }

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => {
    // Another tab changed the data: reload it ("live" updates across tabs).
    if (e.key === DATA_KEY) { state = null; emit(); }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

function getSnapshot(): Snapshot {
  if (!snapshot) snapshot = { state: getState(), userId: getUserId(), now: Date.now() };
  return snapshot;
}

/** null during SSR/hydration, then the live snapshot. */
export function useDemo(): Snapshot | null {
  return useSyncExternalStore(subscribe, getSnapshot, () => null);
}

export function newId() {
  return crypto.randomUUID();
}

export async function hashPassword(password: string) {
  // Demo only: a salted SHA-256 so plain passwords aren't sitting in storage.
  // (Real auth is Supabase's; this browser mode is for walkthroughs.)
  const data = new TextEncoder().encode(`binventory-demo:${password}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
