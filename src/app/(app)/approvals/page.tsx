import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { isDemoMode } from "@/lib/mode";
import { LiveRefresh } from "@/components/live-refresh";
import { DemoApprovalsPage } from "@/components/demo/demo-pages";
import { ApprovalsView, type ApprovalReq } from "@/components/views/approvals-view";

export const metadata = { title: "Approvals · Agora" };

export default async function ApprovalsPage() {
  if (isDemoMode) return <DemoApprovalsPage />;
  const profile = await requireProfile();
  const supabase = await createClient();
  const { data } = await supabase.from("approval_requests").select("*").order("requested_at", { ascending: false }).limit(100);
  const reqs = (data ?? []) as ApprovalReq[];
  const itemIds = reqs.map((r) => r.item_id).filter(Boolean) as string[];
  const saleIds = reqs.map((r) => r.sale_id).filter(Boolean) as string[];
  const [{ data: items }, { data: sales }, { data: stores }, { data: people }] = await Promise.all([
    itemIds.length ? supabase.from("items").select("*").in("id", itemIds) : Promise.resolve({ data: [] }),
    saleIds.length ? supabase.from("sales").select("*").in("id", saleIds) : Promise.resolve({ data: [] }),
    supabase.from("stores").select("id, name"),
    supabase.from("profiles").select("id, full_name"),
  ]);
  return (
    <>
      <ApprovalsView
        reqs={reqs}
        items={items ?? []}
        sales={sales ?? []}
        storeNames={Object.fromEntries((stores ?? []).map((s) => [s.id, s.name]))}
        peopleNames={Object.fromEntries((people ?? []).map((p) => [p.id, p.full_name]))}
        isOwner={profile.role === "owner"}
      />
      <LiveRefresh tables={["approval_requests"]} />
    </>
  );
}
