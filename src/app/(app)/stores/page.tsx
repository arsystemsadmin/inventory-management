import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { isDemoMode } from "@/lib/mode";
import { LiveRefresh } from "@/components/live-refresh";
import { DemoStoresPage } from "@/components/demo/demo-pages";
import { StoresView, type StoreTodaySummary } from "@/components/views/stores-view";
import type { Store } from "@/lib/types";
import { getT } from "@/i18n/server";

export async function generateMetadata() {
  const t = await getT();
  return { title: `${t("nav.stores")} · Binventory` };
}

export default async function StoresPage() {
  if (isDemoMode) return <DemoStoresPage />;
  const profile = await requireProfile();
  const supabase = await createClient();
  const [{ data: stores }, { data: summary }, { data: alertRows }] = await Promise.all([
    supabase.from("stores").select("*"),
    supabase.rpc("sales_summary"),
    supabase.from("items_with_status").select("store_id").eq("archived", false).neq("stock_status", "OK"),
  ]);
  const alerts: Record<string, number> = {};
  (alertRows ?? []).forEach((r) => { alerts[r.store_id] = (alerts[r.store_id] ?? 0) + 1; });
  return (
    <>
      <StoresView stores={(stores ?? []) as Store[]} summary={(summary ?? []) as StoreTodaySummary[]}
        alertCounts={alerts} isOwner={profile.role === "owner"} />
      <LiveRefresh tables={["sales", "items", "stores"]} />
    </>
  );
}
