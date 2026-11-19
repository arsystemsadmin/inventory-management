import Link from "next/link";
import { AlertTriangle, ClipboardCheck, Clock, DollarSign, Package, Wallet } from "lucide-react";
import { requireOwner } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { LiveRefresh } from "@/components/live-refresh";
import { LocalTime } from "@/components/local-time";
import { StockBadge } from "@/components/stock-badge";
import { StoreStatusBadge } from "@/components/stores/store-badges";
import { formatMinutes, formatMoney, STOCK_ORDER, variantLabel } from "@/lib/format";
import { PAY_REFRESH_MS, type ShiftWithPay } from "@/lib/time";
import type { Item, Sale, Store } from "@/lib/types";

export const metadata = { title: "Dashboard · Binventory" };

type Summary = {
  store_id: string; store_name: string; store_status: Store["status"]; today_cents: number; today_units: number;
  today_count: number; week_cents: number; week_units: number;
};

export default async function DashboardPage() {
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

  const summary = (summaryRes.data ?? []) as Summary[];
  const alerts = ((alertsRes.data ?? []) as Item[])
    .sort((a, b) => STOCK_ORDER[a.stock_status] - STOCK_ORDER[b.stock_status] || a.quantity - b.quantity);
  const open = (openRes.data ?? []) as ShiftWithPay[];
  const payroll = (payrollRes.data ?? []) as { amount_cents: number; open_shifts: number }[];
  const recent = (recentRes.data ?? []) as Sale[];
  const name = new Map((peopleRes.data ?? []).map((p) => [p.id, p.full_name]));
  const storeName = new Map(summary.map((s) => [s.store_id, s.store_name]));

  const todayCents = summary.reduce((n, s) => n + Number(s.today_cents), 0);
  const todayUnits = summary.reduce((n, s) => n + Number(s.today_units), 0);
  const weekCents = summary.reduce((n, s) => n + Number(s.week_cents), 0);
  const laborNow = open.reduce((n, s) => n + Number(s.amount_cents), 0);
  const weekPayroll = payroll.reduce((n, p) => n + Number(p.amount_cents), 0);
  const asOf = new Date().toISOString();

  const tile = (label: string, value: string, sub: React.ReactNode, Icon: typeof DollarSign, href?: string) => {
    const body = (
      <Card className="gap-1 py-4 h-full">
        <CardContent className="px-4">
          <div className="flex items-center justify-between text-xs text-muted-foreground">{label}<Icon className="size-4" /></div>
          <div className="text-2xl font-bold">{value}</div>
          <div className="text-xs text-muted-foreground">{sub}</div>
        </CardContent>
      </Card>
    );
    return href ? <Link href={href} className="block">{body}</Link> : body;
  };

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <span className="text-xs text-muted-foreground">
          <span className="mr-1 inline-block size-2 animate-pulse rounded-full bg-emerald-500" />
          Live · pay figures as of <LocalTime iso={asOf} mode="time" />, refresh every 30 min
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
        {tile("Sales today", formatMoney(todayCents), `${todayUnits} items sold`, DollarSign, "/sales?range=today")}
        {tile("This week", formatMoney(weekCents), "all stores", DollarSign, "/sales?range=7d")}
        {tile("On shift now", String(open.length), open.length ? `${formatMoney(laborNow)} accrued` : "nobody clocked in", Clock)}
        {tile("Wages this week", formatMoney(weekPayroll), "owed so far, incl. open shifts", Wallet, "/payroll")}
        {tile("Stock alerts", String(alerts.length), `${alerts.filter((a) => a.stock_status === "OUT").length} out of stock`, AlertTriangle, "/inventory?status=ALERTS")}
        {tile("Approvals", String(pendingRes.count ?? 0), "waiting for you", ClipboardCheck, "/approvals")}
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Sales by store</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow><TableHead>Store</TableHead><TableHead className="text-right">Today</TableHead><TableHead className="text-right">This week</TableHead></TableRow>
              </TableHeader>
              <TableBody>
                {summary.map((s) => (
                  <TableRow key={s.store_id}>
                    <TableCell>
                      <Link href={`/stores/${s.store_id}`} className="font-medium hover:underline">{s.store_name}</Link>{" "}
                      <StoreStatusBadge status={s.store_status} />
                    </TableCell>
                    <TableCell className="text-right">{formatMoney(s.today_cents)}<div className="text-xs text-muted-foreground">{s.today_units} units</div></TableCell>
                    <TableCell className="text-right">{formatMoney(s.week_cents)}<div className="text-xs text-muted-foreground">{s.week_units} units</div></TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow><TableCell>Total</TableCell><TableCell className="text-right">{formatMoney(todayCents)}</TableCell><TableCell className="text-right">{formatMoney(weekCents)}</TableCell></TableRow>
              </TableFooter>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Who&apos;s clocked in</CardTitle></CardHeader>
          <CardContent>
            {open.length === 0 ? <p className="text-sm text-muted-foreground">Nobody is on shift.</p> : (
              <ul className="divide-y text-sm">
                {open.map((s) => (
                  <li key={s.id} className="flex items-center justify-between gap-2 py-2">
                    <div>
                      <div className="font-medium">{name.get(s.profile_id)}</div>
                      <div className="text-xs text-muted-foreground">
                        {storeName.get(s.store_id)} · since <LocalTime iso={s.clock_in} />
                        {Number(s.worked_minutes) > 12 * 60 && <span className="ml-1 font-medium text-red-700">· forgot to clock out?</span>}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold">{formatMoney(Number(s.amount_cents))}</div>
                      <div className="text-xs text-muted-foreground">{formatMinutes(Number(s.worked_minutes))} · {formatMoney(s.hourly_rate_cents_snapshot)}/h</div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><AlertTriangle className="size-4 text-amber-600" /> Stock alerts</CardTitle>
          </CardHeader>
          <CardContent>
            {alerts.length === 0 ? <p className="text-sm text-muted-foreground">Everything is well stocked.</p> : (
              <ul className="max-h-96 divide-y overflow-y-auto text-sm">
                {alerts.map((i) => (
                  <li key={i.id} className="flex items-center justify-between gap-2 py-2">
                    <Link href={`/stores/${i.store_id}`} className="min-w-0">
                      <div className="truncate font-medium">{i.name}{variantLabel(i.size, i.color) && <span className="text-muted-foreground"> · {variantLabel(i.size, i.color)}</span>}</div>
                      <div className="text-xs text-muted-foreground">{storeName.get(i.store_id)} · alert at {i.low_stock_threshold}</div>
                    </Link>
                    <div className="flex shrink-0 items-center gap-2"><span className="font-semibold">{i.quantity}</span><StockBadge status={i.stock_status} /></div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Package className="size-4" /> Latest sales</CardTitle></CardHeader>
          <CardContent>
            {recent.length === 0 ? <p className="text-sm text-muted-foreground">No sales yet.</p> : (
              <ul className="divide-y text-sm">
                {recent.map((s) => (
                  <li key={s.id} className="flex items-center justify-between gap-2 py-2">
                    <div className="min-w-0">
                      <div className="truncate font-medium">{s.quantity} × {s.item_name}{variantLabel(s.size, s.color) && ` (${variantLabel(s.size, s.color)})`}</div>
                      <div className="text-xs text-muted-foreground">{storeName.get(s.store_id)} · {name.get(s.sold_by)} · <LocalTime iso={s.created_at} mode="time" /></div>
                    </div>
                    <div className="shrink-0 font-semibold">{formatMoney(s.total_cents)}</div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
      <LiveRefresh tables={["sales", "items", "time_entries", "approval_requests"]} intervalMs={PAY_REFRESH_MS} toastSales currentUserId={profile.id} />
    </div>
  );
}
