"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LocalTime } from "@/components/local-time";
import { ClockControls } from "@/components/time/clock-controls";
import { formatMinutes, formatMoney } from "@/lib/format";
import type { ShiftWithPay } from "@/lib/time";
import { useT } from "@/i18n/client";

export function ClockView({
  shifts, rateCents, stores, asOf,
}: {
  shifts: ShiftWithPay[]; rateCents: number | null; stores: { id: string; name: string }[]; asOf: string;
}) {
  const t = useT();
  const list = [...shifts].sort((a, b) => b.clock_in.localeCompare(a.clock_in));
  const open = list.find((s) => s.is_open);
  const storeName = new Map(stores.map((s) => [s.id, s.name]));
  const weekMinutes = list.reduce((n, s) => n + Number(s.worked_minutes), 0);
  const weekCents = list.reduce((n, s) => n + Number(s.amount_cents), 0);

  return (
    <div className="mx-auto grid w-full max-w-md gap-4">
      <h1 className="text-2xl font-semibold">{t("nav.clock")}</h1>
      <Card className={open ? "border-emerald-300 bg-emerald-50/50" : ""}>
        <CardHeader>
          <CardTitle>{open ? t("clock.onShiftAt", { store: storeName.get(open.store_id) ?? "" }) : t("clock.clockedOut")}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          {open && (
            <div className="grid grid-cols-2 gap-3 text-center">
              <div className="rounded-lg bg-background p-3 border">
                <div className="text-xs text-muted-foreground">{t("clock.timeOnShift")}</div>
                <div className="text-xl font-semibold">{formatMinutes(Number(open.worked_minutes))}</div>
                <div className="text-xs text-muted-foreground">{t("clock.since")} <LocalTime iso={open.clock_in} mode="time" /></div>
              </div>
              <div className="rounded-lg bg-background p-3 border">
                <div className="text-xs text-muted-foreground">{t("clock.earnedThisShift")}</div>
                <div className="text-xl font-semibold">{formatMoney(Number(open.amount_cents))}</div>
                <div className="text-xs text-muted-foreground">{t("clock.atRate", { rate: formatMoney(open.hourly_rate_cents_snapshot) })}</div>
              </div>
            </div>
          )}
          <ClockControls isOpen={!!open} stores={stores} />
          <p className="text-center text-xs text-muted-foreground">
            {t("clock.updated")} <LocalTime iso={asOf} mode="time" /> · {t("clock.refreshNote")}
          </p>
        </CardContent>
      </Card>

      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-lg border p-3"><div className="text-xs text-muted-foreground">{t("clock.myRate")}</div><div className="font-semibold">{rateCents != null ? t("common.perHour", { rate: formatMoney(rateCents) }) : "—"}</div></div>
        <div className="rounded-lg border p-3"><div className="text-xs text-muted-foreground">{t("clock.hoursThisWeek")}</div><div className="font-semibold">{formatMinutes(weekMinutes)}</div></div>
        <div className="rounded-lg border p-3"><div className="text-xs text-muted-foreground">{t("clock.earnedThisWeek")}</div><div className="font-semibold">{formatMoney(weekCents)}</div></div>
      </div>

      <section className="grid gap-2">
        <h2 className="font-semibold">{t("clock.thisWeeksShifts")}</h2>
        {list.length === 0 ? <p className="text-sm text-muted-foreground">{t("clock.noShifts")}</p> : (
          <ul className="divide-y rounded-lg border text-sm">
            {list.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-2 px-3 py-2">
                <div>
                  <div className="font-medium"><LocalTime iso={s.clock_in} mode="date" /> · {storeName.get(s.store_id) ?? ""}</div>
                  <div className="text-xs text-muted-foreground">
                    <LocalTime iso={s.clock_in} mode="time" /> – {s.clock_out ? <LocalTime iso={s.clock_out} mode="time" /> : <span className="text-emerald-700 font-medium">{t("clock.now")}</span>}
                  </div>
                </div>
                <div className="text-end">
                  <div className="font-semibold">{formatMoney(Number(s.amount_cents))}</div>
                  <div className="text-xs text-muted-foreground">{formatMinutes(Number(s.worked_minutes))}</div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
