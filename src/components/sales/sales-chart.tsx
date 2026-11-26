"use client";

import { useMemo, useState } from "react";
import { BarChart3, Table2 } from "lucide-react";
import { formatMoney } from "@/lib/format";
import { bucketsFor, bucketStart, defaultBucket, nextBucket, salesRangeStart, type SalesBucket, type SalesRange } from "@/lib/sales-range";
import type { Sale } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useLocale, useT } from "@/i18n/client";

type Metric = "revenue" | "units" | "count";
type Bar = { start: Date; revenue: number; units: number; count: number };

/**
 * Sales over time, one bar per hour/day/week/month. Single series, so no
 * legend: the title and metric switch name it. Hover/tap a bar for its value.
 */
export function SalesChart({ sales, range, asOf }: { sales: Sale[]; range: SalesRange; asOf: string }) {
  const t = useT();
  const locale = useLocale();
  const options = bucketsFor(range);
  const [chosen, setChosen] = useState<SalesBucket>(defaultBucket(range));
  const bucket = options.includes(chosen) ? chosen : defaultBucket(range);
  const [metric, setMetric] = useState<Metric>("revenue");
  const [active, setActive] = useState<number | null>(null);
  const [asTable, setAsTable] = useState(false);

  const bars = useMemo(() => {
    const now = new Date(asOf);
    const out: Bar[] = [];
    const index = new Map<number, Bar>();
    for (let d = bucketStart(salesRangeStart(range, now), bucket); d <= now; d = nextBucket(d, bucket)) {
      const b = { start: d, revenue: 0, units: 0, count: 0 };
      out.push(b); index.set(d.getTime(), b);
    }
    for (const s of sales) {
      const b = index.get(bucketStart(new Date(s.created_at), bucket).getTime());
      if (!b) continue;
      b.revenue += s.total_cents; b.units += s.quantity; b.count += 1;
    }
    return out;
  }, [sales, range, bucket, asOf]);

  const value = (b: Bar) => b[metric];
  const fmt = (n: number) => (metric === "revenue" ? formatMoney(n) : n.toLocaleString(locale));
  const max = Math.max(0, ...bars.map(value));
  const peak = bars.reduce<Bar | null>((p, b) => (value(b) > 0 && (!p || value(b) > value(p)) ? b : p), null);

  const label = (d: Date, long = false) => {
    if (bucket === "hour") return d.toLocaleTimeString(locale, { hour: "numeric", ...(long ? { minute: "2-digit" } : {}) });
    if (bucket === "month") return d.toLocaleDateString(locale, { month: long ? "long" : "short", ...(long ? { year: "numeric" } : {}) });
    if (bucket === "week") return long
      ? `${t("salesChart.weekOf")} ${d.toLocaleDateString(locale, { month: "short", day: "numeric" })}`
      : d.toLocaleDateString(locale, { month: "short", day: "numeric" });
    return d.toLocaleDateString(locale, long ? { weekday: "short", month: "short", day: "numeric" } : { month: "short", day: "numeric" });
  };
  // Label only a handful of ticks so they never collide.
  const every = Math.max(1, Math.ceil(bars.length / 6));
  const shown = active !== null ? bars[active] : null;

  const seg = (cur: string, opts: [string, string][], set: (v: string) => void, aria: string) => (
    <div role="group" aria-label={aria} className="inline-flex rounded-md border p-0.5 text-xs font-medium">
      {opts.map(([v, l]) => (
        <button key={v} type="button" aria-pressed={cur === v} onClick={() => set(v)}
          className={cn("rounded px-2.5 py-1", cur === v ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground")}>
          {l}
        </button>
      ))}
    </div>
  );

  return (
    <section className="grid gap-3 rounded-xl border bg-card p-4">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="me-auto font-semibold">{t(`salesChart.title_${metric}`)}</h2>
        {seg(metric, [["revenue", t("sales.revenue")], ["units", t("sales.units")], ["count", t("salesChart.salesCount")]], (v) => setMetric(v as Metric), t("salesChart.metric"))}
        {options.length > 1 && seg(bucket, options.map((b) => [b, t(`salesChart.by_${b}`)]), (v) => setChosen(v as SalesBucket), t("salesChart.groupBy"))}
        <button type="button" onClick={() => setAsTable((v) => !v)} aria-pressed={asTable}
          className="inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs font-medium text-muted-foreground hover:text-foreground">
          {asTable ? <BarChart3 className="size-3.5" /> : <Table2 className="size-3.5" />}
          {asTable ? t("salesChart.showChart") : t("salesChart.showTable")}
        </button>
      </div>

      {/* Readout: the hovered bar, else the peak. Text ink only, never the bar color. */}
      <p className="min-h-5 text-sm text-muted-foreground" aria-live="polite">
        {shown
          ? <><b className="text-foreground">{fmt(value(shown))}</b> · {label(shown.start, true)}
              {metric === "revenue" && <> · {t("salesChart.unitsSales", { units: shown.units, count: shown.count })}</>}</>
          : peak
            ? <>{t("salesChart.peak")}: <b className="text-foreground">{fmt(value(peak))}</b> · {label(peak.start, true)}</>
            : t("sales.empty")}
      </p>

      {asTable ? (
        <div className="max-h-72 overflow-y-auto rounded-md border">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-muted text-xs text-muted-foreground">
              <tr><th className="p-2 text-start font-medium">{t("salesChart.period")}</th><th className="p-2 text-end font-medium">{t("sales.revenue")}</th><th className="p-2 text-end font-medium">{t("sales.units")}</th><th className="p-2 text-end font-medium">{t("salesChart.salesCount")}</th></tr>
            </thead>
            <tbody className="divide-y">
              {[...bars].reverse().map((b) => (
                <tr key={b.start.getTime()}>
                  <td className="p-2">{label(b.start, true)}</td>
                  <td className="p-2 text-end tabular-nums">{formatMoney(b.revenue)}</td>
                  <td className="p-2 text-end tabular-nums">{b.units}</td>
                  <td className="p-2 text-end tabular-nums">{b.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        // Time always runs left to right, also in Hebrew.
        <div dir="ltr" className="grid grid-cols-[auto_1fr] gap-x-2">
          <div className="relative h-48 w-12 text-[10px] text-muted-foreground tabular-nums">
            <span className="absolute end-0 top-0 -translate-y-1/2">{max > 0 ? fmt(max) : ""}</span>
            <span className="absolute end-0 top-1/2 -translate-y-1/2">{max > 0 ? fmt(Math.round(max / 2)) : ""}</span>
            <span className="absolute end-0 bottom-0 translate-y-1/2">{fmt(0)}</span>
          </div>
          <div className="relative h-48" onMouseLeave={() => setActive(null)}>
            {/* Recessive grid */}
            <div className="pointer-events-none absolute inset-x-0 top-0 border-t border-dashed border-border" />
            <div className="pointer-events-none absolute inset-x-0 top-1/2 border-t border-dashed border-border" />
            <div className="pointer-events-none absolute inset-x-0 bottom-0 border-t border-border" />
            <div className="absolute inset-0 flex items-end gap-[2px]">
              {bars.map((b, i) => {
                const v = value(b);
                const h = max > 0 ? (v / max) * 100 : 0;
                return (
                  <button
                    key={b.start.getTime()}
                    type="button"
                    aria-label={`${label(b.start, true)}: ${fmt(v)}`}
                    onMouseEnter={() => setActive(i)}
                    onFocus={() => setActive(i)}
                    onBlur={() => setActive(null)}
                    onClick={() => setActive(active === i ? null : i)}
                    className="group flex h-full min-w-0 flex-1 items-end"
                  >
                    <span
                      className={cn(
                        "block w-full rounded-t-[4px] bg-emerald-600 transition-opacity dark:bg-emerald-400",
                        v > 0 && "min-h-[2px]",
                        active !== null && active !== i && "opacity-40",
                      )}
                      style={{ height: `${h}%` }}
                    />
                  </button>
                );
              })}
            </div>
          </div>
          <div />
          <div className="flex gap-[2px] pt-1 text-[10px] text-muted-foreground">
            {bars.map((b, i) => (
              <span key={b.start.getTime()} className="min-w-0 flex-1 overflow-visible whitespace-nowrap text-center">
                {i % every === 0 ? label(b.start) : ""}
              </span>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
