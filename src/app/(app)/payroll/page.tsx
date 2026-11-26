import { requireOwner } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { isDemoMode } from "@/lib/mode";
import { LiveRefresh } from "@/components/live-refresh";
import { DemoPayrollPage } from "@/components/demo/demo-pages";
import { PayrollView, type PayrollRow } from "@/components/views/payroll-view";
import { addDays, isYmd } from "@/lib/dates";
import { PAY_REFRESH_MS, type ShiftWithPay } from "@/lib/time";
import { getT } from "@/i18n/server";

export async function generateMetadata() {
  const t = await getT();
  return { title: `${t("nav.payroll")} · Binventory` };
}

export default async function PayrollPage({ searchParams }: { searchParams: Promise<{ from?: string; to?: string }> }) {
  const sp = await searchParams;
  if (isDemoMode) return <DemoPayrollPage from={sp.from} to={sp.to} />;
  await requireOwner();
  const supabase = await createClient();
  const [{ data: tz }, { data: weekStart }] = await Promise.all([
    supabase.rpc("business_timezone"),
    supabase.rpc("business_period_start", { p_period: "week" }),
  ]);
  const zone = (tz as string) ?? "UTC";
  const localYmd = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: zone }).format(d);
  const from = isYmd(sp.from) ? sp.from! : localYmd(new Date(weekStart as string));
  const to = isYmd(sp.to) && sp.to! >= from ? sp.to! : localYmd(new Date());
  // Day boundaries in the business timezone; Postgres resolves the zone name.
  const fromTs = `${from} 00:00:00 ${zone}`;
  const toTs = `${addDays(to, 1)} 00:00:00 ${zone}`;

  const [{ data: report, error }, { data: entries }, { data: people }, { data: pay }, { data: stores }] = await Promise.all([
    supabase.rpc("payroll_report", { p_from: fromTs, p_to: toTs }),
    supabase.from("time_entries_with_pay").select("*").gte("clock_in", fromTs).lt("clock_in", toTs).order("clock_in", { ascending: false }),
    supabase.from("profiles").select("id, full_name, active").eq("role", "employee").order("full_name"),
    supabase.from("employee_pay").select("profile_id, hourly_rate_cents"),
    supabase.from("stores").select("id, name").order("name"),
  ]);
  if (error) throw new Error("Could not load payroll");
  const rate = new Map((pay ?? []).map((p) => [p.profile_id, p.hourly_rate_cents]));

  return (
    <>
      <PayrollView
        from={from} to={to} asOf={new Date().toISOString()}
        rows={(report ?? []) as PayrollRow[]}
        entries={(entries ?? []) as ShiftWithPay[]}
        people={(people ?? []).map((p) => ({ id: p.id, full_name: p.full_name, rate_cents: rate.get(p.id) ?? null }))}
        stores={stores ?? []}
      />
      <LiveRefresh tables={["time_entries"]} intervalMs={PAY_REFRESH_MS} />
    </>
  );
}
