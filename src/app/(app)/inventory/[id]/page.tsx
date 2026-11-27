import { notFound } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { isDemoMode } from "@/lib/mode";
import { LiveRefresh } from "@/components/live-refresh";
import { DemoVariationPage } from "@/components/demo/demo-pages";
import { VariationDetailView, type Movement } from "@/components/views/variation-detail-view";
import type { InventoryStore } from "@/components/inventory/inventory-view";
import type { Item, Sale } from "@/lib/types";
import { variantLabel } from "@/lib/format";
import { getT } from "@/i18n/server";

const UUID = /^[0-9a-f-]{36}$/i;

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const t = await getT();
  if (isDemoMode || !UUID.test(id)) return { title: `${t("nav.inventory")} · Binventory` };
  const supabase = await createClient();
  const { data } = await supabase.from("items").select("name, size, color").eq("id", id).maybeSingle();
  const label = data ? `${data.name}${variantLabel(data.size, data.color) ? ` · ${variantLabel(data.size, data.color)}` : ""}` : t("nav.inventory");
  return { title: `${label} · Binventory` };
}

/** Loaded fresh each time a variation is tapped (RLS limits it to stores you can access). */
export default async function VariationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  if (isDemoMode) return <DemoVariationPage id={id} />;
  const profile = await requireProfile();
  const supabase = await createClient();

  const { data: item } = await supabase.from("items_with_status").select("*").eq("id", id).maybeSingle();
  if (!item) notFound();
  const v = item as Item;

  const [{ data: siblings }, { data: store }, { data: sales }, { data: movements }, { data: people }] = await Promise.all([
    supabase.from("items_with_status").select("*").eq("store_id", v.store_id).ilike("name", v.name.replace(/[%_\\]/g, "\\$&")),
    supabase.from("stores").select("id, business_id, name, inventory_locked_at, status").eq("id", v.store_id).maybeSingle(),
    supabase.from("sales").select("*").eq("item_id", id).order("created_at", { ascending: false }).limit(200),
    supabase.from("inventory_movements").select("id, delta, quantity_after, reason, actor_id, created_at")
      .eq("item_id", id).order("created_at", { ascending: false }).limit(100),
    supabase.from("profiles").select("id, full_name"),
  ]);

  return (
    <>
      <VariationDetailView
        item={v}
        siblings={((siblings ?? []) as Item[]).filter((s) => s.name.trim().toLowerCase() === v.name.trim().toLowerCase())}
        store={(store as InventoryStore | null) ?? null}
        sales={(sales ?? []) as Sale[]}
        movements={(movements ?? []) as Movement[]}
        peopleNames={Object.fromEntries((people ?? []).map((p) => [p.id, p.full_name]))}
        role={profile.role}
      />
      <LiveRefresh tables={["items", "sales"]} />
    </>
  );
}
