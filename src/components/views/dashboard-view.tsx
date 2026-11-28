"use client";

import Link from "next/link";
import { AlertTriangle, ClipboardCheck, Clock, Package, Wallet } from "lucide-react";
import { ShekelSign } from "@/components/icons/shekel-sign";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { LocalTime } from "@/components/local-time";
import { StockBadge } from "@/components/stock-badge";
import { PaymentBadge } from "@/components/sales/payment-badge";
import { StoreStatusBadge } from "@/components/stores/store-badges";
import { formatMinutes, formatMoney, STOCK_ORDER, variantLabel } from "@/lib/format";
import type { ShiftWithPay } from "@/lib/time";
import type { Item, Sale, Store } from "@/lib/types";
import { useT } from "@/i18n/client";

export type DashboardSummary = {
  store_id: string; store_name: string; store_status: Store["status"]; today_cents: number; today_units: number;
  week_cents: number; week_units: number;
};

export function DashboardView({
  summary, alerts, openShifts, weekPayrollCents, pendingApprovals, recent, peopleNames, asOf,
}: {
  summary: DashboardSummary[]; alerts: Item[]; openShifts: ShiftWithPay[]; weekPayrollCents: number;
  pendingApprovals: number; recent: Sale[]; peopleNames: Record<string, string>; asOf: string;
}) {
  const t = useT();
  const sortedAlerts = [...alerts].sort((a, b) => STOCK_ORDER[a.stock_status] - STOCK_ORDER[b.stock_status] || a.quantity - b.quantity);
  const storeName = new Map(summary.map((s) => [s.store_id, s.store_name]));
  const todayCents = summary.reduce((n, s) => n + Number(s.today_cents), 0);
  const todayUnits = summary.reduce((n, s) => n + Number(s.today_units), 0);
  const weekCents = summary.reduce((n, s) => n + Number(s.week_cents), 0);
  const laborNow = openShifts.reduce((n, s) => n + Number(s.amount_cents), 0);

  const tile = (label: string, value: string, sub: React.ReactNode, Icon: React.ComponentType<{ className?: string }>, href?: string) => {
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
        <h1 className="text-2xl font-semibold">{t("nav.dashboard")}</h1>
        <span className="text-xs text-muted-foreground">
          <span className="me-1 inline-block size-2 animate-pulse rounded-full bg-emerald-500" />
          {t("dashboard.live")} <LocalTime iso={asOf} mode="time" />{t("dashboard.refreshNote")}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
        {tile(t("dashboard.salesToday"), formatMoney(todayCents), t("dashboard.itemsSold", { count: todayUnits }), ShekelSign, "/sales?range=today")}
        {tile(t("stores.thisWeek"), formatMoney(weekCents), t("dashboard.allStores"), ShekelSign, "/sales?range=7d")}
        {tile(t("dashboard.onShiftNow"), String(openShifts.length), openShifts.length ? t("dashboard.accrued", { amount: formatMoney(laborNow) }) : t("dashboard.nobodyClockedIn"), Clock)}
        {tile(t("dashboard.wagesThisWeek"), formatMoney(weekPayrollCents), t("dashboard.owedSoFar"), Wallet, "/payroll")}
        {tile(t("dashboard.stockAlerts"), String(alerts.length), t("dashboard.outOfStockCount", { count: alerts.filter((a) => a.stock_status === "OUT").length }), AlertTriangle, "/inventory?status=ALERTS")}
        {tile(t("nav.approvals"), String(pendingApprovals), t("dashboard.waitingForYou"), ClipboardCheck, "/approvals")}
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>{t("dashboard.salesByStore")}</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow><TableHead>{t("dashboard.store")}</TableHead><TableHead className="text-end">{t("stores.today")}</TableHead><TableHead className="text-end">{t("stores.thisWeek")}</TableHead></TableRow>
              </TableHeader>
              <TableBody>
                {summary.map((s) => (
                  <TableRow key={s.store_id}>
                    <TableCell>
                      <Link href={`/stores/${s.store_id}`} className="font-medium hover:underline">{s.store_name}</Link>{" "}
                      <StoreStatusBadge status={s.store_status} />
                    </TableCell>
                    <TableCell className="text-end">{formatMoney(s.today_cents)}<div className="text-xs text-muted-foreground">{t("dashboard.units", { count: s.today_units })}</div></TableCell>
                    <TableCell className="text-end">{formatMoney(s.week_cents)}<div className="text-xs text-muted-foreground">{t("dashboard.units", { count: s.week_units })}</div></TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow><TableCell>{t("common.total")}</TableCell><TableCell className="text-end">{formatMoney(todayCents)}</TableCell><TableCell className="text-end">{formatMoney(weekCents)}</TableCell></TableRow>
              </TableFooter>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>{t("dashboard.whosClockedIn")}</CardTitle></CardHeader>
          <CardContent>
            {openShifts.length === 0 ? <p className="text-sm text-muted-foreground">{t("dashboard.nobodyOnShift")}</p> : (
              <ul className="divide-y text-sm">
                {openShifts.map((s) => (
                  <li key={s.id} className="flex items-center justify-between gap-2 py-2">
                    <div>
                      <div className="font-medium">{peopleNames[s.profile_id]}</div>
                      <div className="text-xs text-muted-foreground">
                        {storeName.get(s.store_id)} · {t("clock.since")} <LocalTime iso={s.clock_in} />
                        {Number(s.worked_minutes) > 12 * 60 && <span className="ms-1 font-medium text-red-700">· {t("dashboard.forgotClockOut")}</span>}
                      </div>
                    </div>
                    <div className="text-end">
                      <div className="font-semibold">{formatMoney(Number(s.amount_cents))}</div>
                      <div className="text-xs text-muted-foreground">{formatMinutes(Number(s.worked_minutes))} · {t("common.perHour", { rate: formatMoney(s.hourly_rate_cents_snapshot) })}</div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><AlertTriangle className="size-4 text-amber-600" /> {t("dashboard.stockAlerts")}</CardTitle>
          </CardHeader>
          <CardContent>
            {sortedAlerts.length === 0 ? <p className="text-sm text-muted-foreground">{t("dashboard.wellStocked")}</p> : (
              <ul className="max-h-96 divide-y overflow-y-auto text-sm">
                {sortedAlerts.map((i) => (
                  <li key={i.id} className="flex items-center justify-between gap-2 py-2">
                    <Link href={`/stores/${i.store_id}`} className="min-w-0">
                      <div className="truncate font-medium">{i.name}{variantLabel(i.size, i.color) && <span className="text-muted-foreground"> · {variantLabel(i.size, i.color)}</span>}</div>
                      <div className="text-xs text-muted-foreground">{storeName.get(i.store_id)} · {t("dashboard.alertAt", { count: i.low_stock_threshold })}</div>
                    </Link>
                    <div className="flex shrink-0 items-center gap-2"><span className="font-semibold">{i.quantity}</span><StockBadge status={i.stock_status} /></div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Package className="size-4" /> {t("stores.latestSales")}</CardTitle></CardHeader>
          <CardContent>
            {recent.length === 0 ? <p className="text-sm text-muted-foreground">{t("stores.noSales")}</p> : (
              <ul className="divide-y text-sm">
                {recent.map((s) => (
                  <li key={s.id} className="flex items-center justify-between gap-2 py-2">
                    <div className="min-w-0">
                      <div className="truncate font-medium">{s.quantity} × {s.item_name}{variantLabel(s.size, s.color) && ` (${variantLabel(s.size, s.color)})`}</div>
                      <div className="text-xs text-muted-foreground">{storeName.get(s.store_id)} · {peopleNames[s.sold_by]} · <LocalTime iso={s.created_at} mode="time" /></div>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-0.5">
                      <span className="font-semibold">{formatMoney(s.total_cents)}</span>
                      <PaymentBadge method={s.payment_method} cashCents={s.cash_cents} creditCents={s.credit_cents} otherName={s.payment_other} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
