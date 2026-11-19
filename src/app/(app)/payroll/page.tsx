import { AlertTriangle } from "lucide-react";
import { requireOwner } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { LiveRefresh } from "@/components/live-refresh";
import { LocalTime } from "@/components/local-time";
import { PayrollEntries } from "@/components/time/time-entry-dialog";
import { formatMinutes, formatMoney } from "@/lib/format";
import { PAY_REFRESH_MS, type ShiftWithPay } from "@/lib/time";

export const metadata = { title: "Payroll · Binventory" };

type Row = {
  profile_id: string; full_name: string; active: boolean; current_rate_cents: number | null;
  shifts: number; open_shifts: number; worked_minutes: number; amount_cents: number;
};

const isDate = (s?: string) => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);
function addDays(ymd: string, n: number) {
  const d = new Date(`${ymd}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export default async function PayrollPage({ searchParams }: { searchParams: Promise<{ from?: string; to?: string }> }) {
  await requireOwner();
  const sp = await searchParams;
  const supabase = await createClient();
  const [{ data: tz }, { data: weekStart }] = await Promise.all([
    supabase.rpc("business_timezone"),
    supabase.rpc("business_period_start", { p_period: "week" }),
  ]);
  const zone = (tz as string) ?? "UTC";
  const localYmd = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: zone }).format(d);
  const from = isDate(sp.from) ? sp.from! : localYmd(new Date(weekStart as string));
  const to = isDate(sp.to) && sp.to! >= from ? sp.to! : localYmd(new Date());
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
  const rows = ((report ?? []) as Row[]).filter((r) => r.shifts > 0 || r.active);
  const list = (entries ?? []) as ShiftWithPay[];
  const rate = new Map((pay ?? []).map((p) => [p.profile_id, p.hourly_rate_cents]));
  const totalCents = rows.reduce((n, r) => n + Number(r.amount_cents), 0);
  const totalMinutes = rows.reduce((n, r) => n + Number(r.worked_minutes), 0);
  const openCount = rows.reduce((n, r) => n + Number(r.open_shifts), 0);

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-2xl font-semibold">Payroll</h1>
        <span className="text-xs text-muted-foreground">As of <LocalTime iso={new Date().toISOString()} mode="time" /> · open shifts accrue and refresh every 30 min</span>
      </div>
      <form className="flex flex-wrap items-end gap-2" action="/payroll">
        <label className="grid gap-1 text-sm">From<input type="date" name="from" defaultValue={from} className="h-10 rounded-md border px-3" /></label>
        <label className="grid gap-1 text-sm">To<input type="date" name="to" defaultValue={to} className="h-10 rounded-md border px-3" /></label>
        <button type="submit" className="h-10 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground">Show</button>
      </form>

      {openCount > 0 && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          <AlertTriangle className="size-4 shrink-0" />
          {openCount} shift{openCount > 1 ? "s are" : " is"} still open. Amounts include time up to now. Close them below if someone forgot to clock out.
        </div>
      )}

      <Card className="py-2">
        <CardContent className="px-2 sm:px-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead className="text-right">Hours</TableHead>
                <TableHead className="text-right">Current rate</TableHead>
                <TableHead className="text-right">Owed</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.profile_id}>
                  <TableCell>
                    <div className="font-medium">{r.full_name}</div>
                    <div className="text-xs text-muted-foreground">
                      {r.shifts} shift{r.shifts === 1 ? "" : "s"}
                      {r.open_shifts > 0 && <span className="ml-1 rounded bg-amber-100 px-1 font-semibold text-amber-800">{r.open_shifts} open</span>}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">{formatMinutes(Number(r.worked_minutes))}</TableCell>
                  <TableCell className="text-right">{r.current_rate_cents != null ? `${formatMoney(r.current_rate_cents)}/h` : "—"}</TableCell>
                  <TableCell className="text-right font-semibold">{formatMoney(Number(r.amount_cents))}</TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell>Total</TableCell>
                <TableCell className="text-right">{formatMinutes(totalMinutes)}</TableCell>
                <TableCell />
                <TableCell className="text-right">{formatMoney(totalCents)}</TableCell>
              </TableRow>
            </TableFooter>
          </Table>
          <p className="px-2 pt-2 text-xs text-muted-foreground">
            Owed amounts use the rate saved on each shift when it started, so changing a rate never rewrites past pay.
          </p>
        </CardContent>
      </Card>

      <PayrollEntries
        entries={list}
        people={(people ?? []).map((p) => ({ id: p.id, full_name: p.full_name, rate_cents: rate.get(p.id) ?? null }))}
        stores={stores ?? []}
      />
      <LiveRefresh tables={["time_entries"]} intervalMs={PAY_REFRESH_MS} />
    </div>
  );
}
