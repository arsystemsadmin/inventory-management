import { notFound } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { loadInventory } from "@/lib/queries";
import { isDemoMode } from "@/lib/mode";
import { LiveRefresh } from "@/components/live-refresh";
import { DemoStorePage } from "@/components/demo/demo-pages";
import { StoreDetailView, type RecentSale } from "@/components/views/store-detail-view";
import type { StoreTodaySummary } from "@/components/views/stores-view";
import type { Store } from "@/lib/types";

export default async function StorePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (isDemoMode) return <DemoStorePage id={id} />;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const profile = await requireProfile();
  const supabase = await createClient();
  const isOwner = profile.role === "owner";

  const { data: store } = await supabase.from("stores").select("*").eq("id", id).maybeSingle();
  if (!store) notFound(); // RLS: unassigned stores simply don't exist for employees

  const [{ items, stores }, { data: summary }, { data: recent }, members, employees] = await Promise.all([
    loadInventory(id),
    supabase.rpc("sales_summary"),
    supabase.from("sales").select("*")
      .eq("store_id", id).order("created_at", { ascending: false }).limit(8),
    isOwner ? supabase.from("store_members").select("profile_id").eq("store_id", id) : Promise.resolve({ data: [] }),
    isOwner ? supabase.from("profiles").select("id, full_name, active").eq("role", "employee").order("full_name") : Promise.resolve({ data: [] }),
  ]);

  return (
    <>
      <StoreDetailView
        store={store as Store}
        items={items}
        stores={stores}
        today={((summary ?? []) as StoreTodaySummary[]).find((r) => r.store_id === id)}
        recent={(recent ?? []) as RecentSale[]}
        role={profile.role}
        employees={(employees.data ?? []) as { id: string; full_name: string; active: boolean }[]}
        memberIds={(members.data ?? []).map((m: { profile_id: string }) => m.profile_id)}
      />
      <LiveRefresh tables={["items", "sales", "stores"]} toastSales currentUserId={profile.id} />
    </>
  );
}
