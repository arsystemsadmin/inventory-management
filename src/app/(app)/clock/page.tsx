import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LiveRefresh } from "@/components/live-refresh";
import { LocalTime } from "@/components/local-time";
import { ClockControls } from "@/components/time/clock-controls";
import { formatMinutes, formatMoney } from "@/lib/format";
import { PAY_REFRESH_MS, type ShiftWithPay } from "@/lib/time";

export const metadata = { title: "Clock · Binventory" };

export default async function ClockPage() {
  const profile = await requireProfile();
  const supabase = await createClient();
  const { data: weekStart } = await supabase.rpc("business_period_start", { p_period: "week" });

  const [{ data: shifts }, { data: pay }, { data: stores }] = await Promise.all([
    supabase.from("time_entries_with_pay").select("*").eq("profile_id", profile.id)
      .or(`clock_out.is.null,clock_in.gte.${weekStart}`).order("clock_in", { ascending: false }),
    supabase.from("employee_pay").select("hourly_rate_cents").eq("profile_id", profile.id).maybeSingle(),
    supabase.from("stores").select("id, name, status").neq("status", "closed").order("name"),
  ]);
  const list = (shifts ?? []) as ShiftWithPay[];
  const open = list.find((s) => s.is_open);
  const storeName = new Map((stores ?? []).map((s) => [s.id, s.name]));
  const weekMinutes = list.reduce((n, s) => n + Number(s.worked_minutes), 0);
  const weekCents = list.reduce((n, s) => n + Number(s.amount_cents), 0);
  const asOf = new Date().toISOString();

  return (
    <div className="mx-auto grid w-full max-w-md gap-4">
      <h1 className="text-2xl font-semibold">Clock</h1>
      <Card className={open ? "border-emerald-300 bg-emerald-50/50" : ""}>
        <CardHeader>
          <CardTitle>{open ? `On shift at ${storeName.get(open.store_id) ?? "store"}` : "You're clocked out"}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          {open && (
            <div className="grid grid-cols-2 gap-3 text-center">
              <div className="rounded-lg bg-background p-3 border">
                <div className="text-xs text-muted-foreground">Time on shift</div>
                <div className="text-xl font-semibold">{formatMinutes(Number(open.worked_minutes))}</div>
                <div className="text-xs text-muted-foreground">since <LocalTime iso={open.clock_in} mode="time" /></div>
              </div>
              <div className="rounded-lg bg-background p-3 border">
                <div className="text-xs text-muted-foreground">Earned this shift</div>
                <div className="text-xl font-semibold">{formatMoney(Number(open.amount_cents))}</div>
                <div className="text-xs text-muted-foreground">at {formatMoney(open.hourly_rate_cents_snapshot)}/h</div>
              </div>
            </div>
          )}
          <ClockControls isOpen={!!open} stores={(stores ?? []).map((s) => ({ id: s.id, name: s.name }))} />
          <p className="text-center text-xs text-muted-foreground">
            Updated <LocalTime iso={asOf} mode="time" /> · pay refreshes every 30 minutes
          </p>
        </CardContent>
      </Card>

      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-lg border p-3"><div className="text-xs text-muted-foreground">My rate</div><div className="font-semibold">{pay ? `${formatMoney(pay.hourly_rate_cents)}/h` : "—"}</div></div>
        <div className="rounded-lg border p-3"><div className="text-xs text-muted-foreground">Hours this week</div><div className="font-semibold">{formatMinutes(weekMinutes)}</div></div>
        <div className="rounded-lg border p-3"><div className="text-xs text-muted-foreground">Earned this week</div><div className="font-semibold">{formatMoney(weekCents)}</div></div>
      </div>

      <section className="grid gap-2">
        <h2 className="font-semibold">This week&apos;s shifts</h2>
        {list.length === 0 ? <p className="text-sm text-muted-foreground">No shifts yet this week.</p> : (
          <ul className="divide-y rounded-lg border text-sm">
            {list.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-2 px-3 py-2">
                <div>
                  <div className="font-medium"><LocalTime iso={s.clock_in} mode="date" /> · {storeName.get(s.store_id) ?? "Store"}</div>
                  <div className="text-xs text-muted-foreground">
                    <LocalTime iso={s.clock_in} mode="time" /> – {s.clock_out ? <LocalTime iso={s.clock_out} mode="time" /> : <span className="text-emerald-700 font-medium">now</span>}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-semibold">{formatMoney(Number(s.amount_cents))}</div>
                  <div className="text-xs text-muted-foreground">{formatMinutes(Number(s.worked_minutes))}</div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
      <LiveRefresh tables={["time_entries"]} intervalMs={PAY_REFRESH_MS} />
    </div>
  );
}
