"use client";

import { AlertTriangle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { LocalTime } from "@/components/local-time";
import { PayrollEntries } from "@/components/time/time-entry-dialog";
import { formatMinutes, formatMoney } from "@/lib/format";
import type { ShiftWithPay } from "@/lib/time";
import { useT } from "@/i18n/client";

export type PayrollRow = {
  profile_id: string; full_name: string; active: boolean; current_rate_cents: number | null;
  shifts: number; open_shifts: number; worked_minutes: number; amount_cents: number;
};

export function PayrollView({
  from, to, rows, entries, people, stores, asOf,
}: {
  from: string; to: string; rows: PayrollRow[]; entries: ShiftWithPay[];
  people: { id: string; full_name: string; rate_cents: number | null }[]; stores: { id: string; name: string }[]; asOf: string;
}) {
  const t = useT();
  const visible = rows.filter((r) => r.shifts > 0 || r.active);
  const totalCents = visible.reduce((n, r) => n + Number(r.amount_cents), 0);
  const totalMinutes = visible.reduce((n, r) => n + Number(r.worked_minutes), 0);
  const openCount = visible.reduce((n, r) => n + Number(r.open_shifts), 0);

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-2xl font-semibold">{t("nav.payroll")}</h1>
        <span className="text-xs text-muted-foreground">{t("payroll.asOf")} <LocalTime iso={asOf} mode="time" /> · {t("payroll.refreshNote")}</span>
      </div>
      <form className="flex flex-wrap items-end gap-2" action="/payroll">
        <label className="grid gap-1 text-sm">{t("payroll.from")}<input type="date" name="from" defaultValue={from} className="h-10 rounded-md border px-3" /></label>
        <label className="grid gap-1 text-sm">{t("payroll.to")}<input type="date" name="to" defaultValue={to} className="h-10 rounded-md border px-3" /></label>
        <button type="submit" className="h-10 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground">{t("payroll.show")}</button>
      </form>

      {openCount > 0 && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          <AlertTriangle className="size-4 shrink-0" />
          {t("payroll.openWarning", { count: openCount })}
        </div>
      )}

      <Card className="py-2">
        <CardContent className="px-2 sm:px-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("common.employee")}</TableHead>
                <TableHead className="text-end">{t("payroll.hours")}</TableHead>
                <TableHead className="text-end">{t("payroll.currentRate")}</TableHead>
                <TableHead className="text-end">{t("payroll.owed")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.map((r) => (
                <TableRow key={r.profile_id}>
                  <TableCell>
                    <div className="font-medium">{r.full_name}</div>
                    <div className="text-xs text-muted-foreground">
                      {t("payroll.shifts", { count: r.shifts })}
                      {r.open_shifts > 0 && <span className="ms-1 rounded bg-amber-100 px-1 font-semibold text-amber-800">{t("payroll.openCount", { count: r.open_shifts })}</span>}
                    </div>
                  </TableCell>
                  <TableCell className="text-end">{formatMinutes(Number(r.worked_minutes))}</TableCell>
                  <TableCell className="text-end">{r.current_rate_cents != null ? t("common.perHour", { rate: formatMoney(r.current_rate_cents) }) : "—"}</TableCell>
                  <TableCell className="text-end font-semibold">{formatMoney(Number(r.amount_cents))}</TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell>{t("common.total")}</TableCell>
                <TableCell className="text-end">{formatMinutes(totalMinutes)}</TableCell>
                <TableCell />
                <TableCell className="text-end">{formatMoney(totalCents)}</TableCell>
              </TableRow>
            </TableFooter>
          </Table>
          <p className="px-2 pt-2 text-xs text-muted-foreground">
            {t("payroll.snapshotNote")}
          </p>
        </CardContent>
      </Card>

      <PayrollEntries entries={entries} people={people} stores={stores} />
    </div>
  );
}
