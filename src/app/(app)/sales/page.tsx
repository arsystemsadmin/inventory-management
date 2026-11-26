import { cookies } from "next/headers";
import { requireProfile } from "@/lib/auth";
import { ACTIVE_STORE_COOKIE } from "@/lib/active-store-cookie";
import { createClient } from "@/lib/supabase/server";
import { isDemoMode } from "@/lib/mode";
import { LiveRefresh } from "@/components/live-refresh";
import { DemoSalesPage } from "@/components/demo/demo-pages";
import { SalesView } from "@/components/views/sales-view";
import { parseSalesRange, salesRangeStart } from "@/lib/sales-range";
import type { Sale } from "@/lib/types";
import { getT } from "@/i18n/server";

export async function generateMetadata() {
  const t = await getT();
  return { title: `${t("nav.sales")} · Binventory` };
}

export default async function SalesPage({ searchParams }: { searchParams: Promise<{ store?: string; range?: string }> }) {
  const sp = await searchParams;
  // No store in the link: use the store you're working in (an explicit "All stores" sends store=).
  const raw = sp.store ?? (await cookies()).get(ACTIVE_STORE_COOKIE)?.value;
  const store = raw && /^[0-9a-f-]{36}$/i.test(raw) ? raw : undefined;
  if (isDemoMode) return <DemoSalesPage store={store} range={sp.range} />;
  const profile = await requireProfile();
  const range = parseSalesRange(sp.range);
  const supabase = await createClient();

  let q = supabase.from("sales").select("*").gte("created_at", salesRangeStart(range).toISOString())
    .order("created_at", { ascending: false }).limit(300);
  if (store) q = q.eq("store_id", store);

  const [{ data: sales }, { data: stores }, { data: people }, { data: pendingVoids }] = await Promise.all([
    q,
    supabase.from("stores").select("id, name").order("name"),
    supabase.from("profiles").select("id, full_name"),
    supabase.from("approval_requests").select("sale_id").eq("kind", "void_sale").eq("status", "pending"),
  ]);

  return (
    <>
      <SalesView
        sales={(sales ?? []) as Sale[]}
        stores={stores ?? []}
        peopleNames={Object.fromEntries((people ?? []).map((p) => [p.id, p.full_name]))}
        pendingVoidIds={(pendingVoids ?? []).map((r) => r.sale_id)}
        isOwner={profile.role === "owner"}
        range={range}
        store={store}
      />
      <LiveRefresh tables={["sales"]} toastSales={profile.role === "owner"} currentUserId={profile.id} />
    </>
  );
}
