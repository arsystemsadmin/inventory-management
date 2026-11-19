import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Item } from "@/lib/types";
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
