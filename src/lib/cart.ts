"use client";

import { useSyncExternalStore } from "react";
import type { Item } from "@/lib/types";

/**
 * The quick-sale cart: variations waiting to be checked out together.
 * Shared by every sell sheet and the floating Sell button; kept for this tab
 * (sessionStorage) so a refresh doesn't lose it.
 */
export type CartLine = { item: Item; quantity: number };

const KEY = "binventory-cart";
const OPEN_EVENT = "binventory:open-cart";
let lines: CartLine[] = [];
let loaded = false;
const listeners = new Set<() => void>();

function load() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try { lines = JSON.parse(window.sessionStorage.getItem(KEY) ?? "[]") as CartLine[]; } catch { lines = []; }
}
function save(next: CartLine[]) {
  lines = next;
  try { window.sessionStorage.setItem(KEY, JSON.stringify(next)); } catch { /* private mode */ }
  listeners.forEach((l) => l());
}
const EMPTY: CartLine[] = [];

export function useCart() {
  return useSyncExternalStore(
    (l) => { listeners.add(l); return () => listeners.delete(l); },
    () => { load(); return lines; },
    () => EMPTY,
  );
}

/** Adds (or tops up) a line, never beyond what's in stock. Returns the quantity now in the cart. */
export function addToCart(item: Item, quantity: number) {
  load();
  const existing = lines.find((l) => l.item.id === item.id);
  const q = Math.min(item.quantity, (existing?.quantity ?? 0) + quantity);
  save(existing
    ? lines.map((l) => (l.item.id === item.id ? { item, quantity: q } : l))
    : [...lines, { item, quantity: q }]);
  return q;
}
export function setCartQty(itemId: string, quantity: number) {
  load();
  save(quantity <= 0 ? lines.filter((l) => l.item.id !== itemId)
    : lines.map((l) => (l.item.id === itemId ? { ...l, quantity: Math.min(quantity, l.item.quantity) } : l)));
}
export function removeFromCart(itemId: string) { setCartQty(itemId, 0); }
export function clearCart() { save([]); }
export const cartTotal = (ls: CartLine[]) => ls.reduce((n, l) => n + l.quantity * l.item.price_cents, 0);
export const cartUnits = (ls: CartLine[]) => ls.reduce((n, l) => n + l.quantity, 0);

/** Ask the floating Sell button to open on the cart (e.g. "View cart" in a toast). */
export function openCart() { window.dispatchEvent(new Event(OPEN_EVENT)); }
export function onOpenCart(fn: () => void) {
  window.addEventListener(OPEN_EVENT, fn);
  return () => window.removeEventListener(OPEN_EVENT, fn);
}

/** Swap in fresh copies of the items (price, stock) after a reload; drops lines that can't be sold anymore. */
export function refreshCart(fresh: Item[]) {
  load();
  if (!lines.length) return;
  const byId = new Map(fresh.map((i) => [i.id, i]));
  save(lines.flatMap((l) => {
    const item = byId.get(l.item.id);
    if (!item) return [l]; // not in this list (e.g. another store) - keep as is
    if (item.archived || item.quantity <= 0) return [];
    return [{ item, quantity: Math.min(l.quantity, item.quantity) }];
  }));
}
