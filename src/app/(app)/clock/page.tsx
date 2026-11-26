import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { isDemoMode } from "@/lib/mode";
import { LiveRefresh } from "@/components/live-refresh";
import { DemoClockPage } from "@/components/demo/demo-pages";
import { ClockView } from "@/components/views/clock-view";
import { PAY_REFRESH_MS, type ShiftWithPay } from "@/lib/time";
import { getT } from "@/i18n/server";

export async function generateMetadata() {
  const t = await getT();
  return { title: `${t("nav.clock")} · Binventory` };
}

export default async function ClockPage() {
  if (isDemoMode) return <DemoClockPage />;
  const profile = await requireProfile();
  const supabase = await createClient();
  const { data: weekStart } = await supabase.rpc("business_period_start", { p_period: "week" });
  const [{ data: shifts }, { data: pay }, { data: stores }] = await Promise.all([
    supabase.from("time_entries_with_pay").select("*").eq("profile_id", profile.id)
      .or(`clock_out.is.null,clock_in.gte.${weekStart}`).order("clock_in", { ascending: false }),
    supabase.from("employee_pay").select("hourly_rate_cents").eq("profile_id", profile.id).maybeSingle(),
    supabase.from("stores").select("id, name").neq("status", "closed").order("name"),
  ]);
  return (
    <>
      <ClockView shifts={(shifts ?? []) as ShiftWithPay[]} rateCents={pay?.hourly_rate_cents ?? null}
        stores={stores ?? []} asOf={new Date().toISOString()} />
      <LiveRefresh tables={["time_entries"]} intervalMs={PAY_REFRESH_MS} />
    </>
  );
}
