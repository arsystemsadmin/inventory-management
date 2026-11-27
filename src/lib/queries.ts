import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Item, Movement, Sale } from "@/lib/types";
import type { InventoryStore } from "@/components/inventory/inventory-view";

/** Items + stores visible to the caller (RLS does the scoping). */
export async function loadInventory(storeId?: string) {
  const supabase = await createClient();
  let itemsQ = supabase.from("items_with_status").select("*").order("name");
  let storesQ = supabase.from("stores").select("id, business_id, name, inventory_locked_at, status").order("name");
  if (storeId) {
    itemsQ = itemsQ.eq("store_id", storeId);
    storesQ = storesQ.eq("id", storeId);
  }
  const [{ data: items }, { data: stores }] = await Promise.all([itemsQ, storesQ]);
  return { items: (items ?? []) as Item[], stores: (stores ?? []) as InventoryStore[] };
}

/**
 * Everything a product or color page needs, starting from any one variation
 * id: every variation of that product (same store + name, removed ones too),
 * the store, and recent sales and stock changes. RLS scopes all of it.
 */
export async function loadProductDetail(id: string) {
  const supabase = await createClient();
  const { data: anchor } = await supabase.from("items_with_status").select("*").eq("id", id).maybeSingle();
  if (!anchor) return null;
  const a = anchor as Item;
  const [{ data: sameName }, { data: store }, { data: people }] = await Promise.all([
    supabase.from("items_with_status").select("*").eq("store_id", a.store_id).ilike("name", a.name.replace(/[%_\\]/g, "\\$&")),
    supabase.from("stores").select("id, business_id, name, inventory_locked_at, status").eq("id", a.store_id).maybeSingle(),
    supabase.from("profiles").select("id, full_name"),
  ]);
  const key = a.name.trim().toLowerCase();
  const siblings = ((sameName ?? []) as Item[]).filter((s) => s.name.trim().toLowerCase() === key);
  const ids = siblings.map((s) => s.id);
  const [{ data: sales }, { data: movements }] = await Promise.all([
    supabase.from("sales").select("*").in("item_id", ids).order("created_at", { ascending: false }).limit(500),
    supabase.from("inventory_movements").select("id, item_id, delta, quantity_after, reason, actor_id, created_at")
      .in("item_id", ids).order("created_at", { ascending: false }).limit(300),
  ]);
  return {
    anchor: a,
    siblings,
    store: (store as InventoryStore | null) ?? null,
    sales: (sales ?? []) as Sale[],
    movements: (movements ?? []) as Movement[],
    peopleNames: Object.fromEntries((people ?? []).map((p) => [p.id, p.full_name])) as Record<string, string>,
  };
}
export type ProductDetail = NonNullable<Awaited<ReturnType<typeof loadProductDetail>>>;
