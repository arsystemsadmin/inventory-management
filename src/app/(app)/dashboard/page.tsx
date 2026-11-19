import { requireOwner } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { isDemoMode } from "@/lib/mode";
import { LiveRefresh } from "@/components/live-refresh";
import { DemoDashboardPage } from "@/components/demo/demo-pages";
import { DashboardView, type DashboardSummary } from "@/components/views/dashboard-view";
import { PAY_REFRESH_MS, type ShiftWithPay } from "@/lib/time";
import type { Item, Sale } from "@/lib/types";

export const metadata = { title: "Dashboard · Binventory" };

export default async function DashboardPage() {
  if (isDemoMode) return <DemoDashboardPage />;
  const profile = await requireOwner();
  const supabase = await createClient();
  const { data: weekStart } = await supabase.rpc("business_period_start", { p_period: "week" });
  const tomorrow = new Date(Date.now() + 86_400_000).toISOString();

  const [summaryRes, alertsRes, openRes, payrollRes, pendingRes, recentRes, peopleRes] = await Promise.all([
    supabase.rpc("sales_summary"),
    supabase.from("items_with_status").select("*").eq("archived", false).neq("stock_status", "OK").limit(200),
    supabase.from("time_entries_with_pay").select("*").eq("is_open", true),
    supabase.rpc("payroll_report", { p_from: weekStart, p_to: tomorrow }),
    supabase.from("approval_requests").select("id", { count: "exact", head: true }).eq("status", "pending"),
    supabase.from("sales").select("*").is("voided_at", null).order("created_at", { ascending: false }).limit(10),
    supabase.from("profiles").select("id, full_name"),
  ]);

  return (
    <>
      <DashboardView
        summary={(summaryRes.data ?? []) as DashboardSummary[]}
        alerts={(alertsRes.data ?? []) as Item[]}
        openShifts={(openRes.data ?? []) as ShiftWithPay[]}
        weekPayrollCents={((payrollRes.data ?? []) as { amount_cents: number }[]).reduce((n, p) => n + Number(p.amount_cents), 0)}
        pendingApprovals={pendingRes.count ?? 0}
        recent={(recentRes.data ?? []) as Sale[]}
        peopleNames={Object.fromEntries((peopleRes.data ?? []).map((p) => [p.id, p.full_name]))}
        asOf={new Date().toISOString()}
      />
      <LiveRefresh tables={["sales", "items", "time_entries", "approval_requests"]} intervalMs={PAY_REFRESH_MS} toastSales currentUserId={profile.id} />
    </>
  );
}
