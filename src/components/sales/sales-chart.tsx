"use client";

import { useMemo, useState } from "react";
import { LineChart, Table2 } from "lucide-react";
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
    <section className="grid gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="me-auto" />
        {seg(metric, [["revenue", t("sales.revenue")], ["units", t("sales.units")], ["count", t("salesChart.salesCount")]], (v) => setMetric(v as Metric), t("salesChart.metric"))}
        {options.length > 1 && seg(bucket, options.map((b) => [b, t(`salesChart.by_${b}`)]), (v) => setChosen(v as SalesBucket), t("salesChart.groupBy"))}
        <button type="button" onClick={() => setAsTable((v) => !v)} aria-pressed={asTable}
          className="inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs font-medium text-muted-foreground hover:text-foreground">
          {asTable ? <LineChart className="size-3.5" /> : <Table2 className="size-3.5" />}
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
            {/* Line + light area. Points sit in the middle of each period's column. */}
            {(() => {
              const n = Math.max(1, bars.length);
              const pts = bars.map((b, i) => ({ x: i + 0.5, y: max > 0 ? 100 - (value(b) / max) * 100 : 100 }));
              const line = pts.map((p, i) => `${i ? "L" : "M"}${p.x},${p.y}`).join(" ");
              const area = pts.length ? `${line} L${pts[pts.length - 1].x},100 L${pts[0].x},100 Z` : "";
              const a = active !== null ? pts[active] : null;
              return (
                <>
                  <svg viewBox={`0 0 ${n} 100`} preserveAspectRatio="none" className="pointer-events-none absolute inset-0 h-full w-full overflow-visible" aria-hidden>
                    <path d={area} className="fill-emerald-600/10 dark:fill-emerald-400/15" />
                    {a && <line x1={a.x} x2={a.x} y1={0} y2={100} className="stroke-border" strokeWidth={1} vectorEffect="non-scaling-stroke" />}
                    <path d={line} fill="none" className="stroke-emerald-600 dark:stroke-emerald-400" strokeWidth={2}
                      strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
                  </svg>
                  {/* Dots as HTML so they stay round at any width; all shown when there are few points. */}
                  {pts.map((p, i) => (bars.length <= 31 || i === active) && (
                    <span key={i} aria-hidden
                      className={cn("pointer-events-none absolute size-2 -translate-x-1/2 translate-y-1/2 rounded-full border-2 border-emerald-600 bg-background dark:border-emerald-400",
                        i === active && "size-3 bg-emerald-600 dark:bg-emerald-400")}
                      style={{ left: `${(p.x / n) * 100}%`, bottom: `${100 - p.y}%` }} />
                  ))}
                </>
              );
            })()}
            {/* Hit areas: one per period, bigger than the dot. */}
            <div className="absolute inset-0 flex">
              {bars.map((b, i) => (
                <button
                  key={b.start.getTime()}
                  type="button"
                  aria-label={`${label(b.start, true)}: ${fmt(value(b))}`}
                  onMouseEnter={() => setActive(i)}
                  onFocus={() => setActive(i)}
                  onBlur={() => setActive(null)}
                  onClick={() => setActive(active === i ? null : i)}
                  className="h-full min-w-0 flex-1"
                />
              ))}
            </div>
          </div>
          <div />
          <div className="flex pt-1 text-[10px] text-muted-foreground">
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
