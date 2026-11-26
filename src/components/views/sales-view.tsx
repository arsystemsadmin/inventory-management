"use client";

import { LocalTime } from "@/components/local-time";
import { SaleRowActions } from "@/components/sales/sale-row-actions";
import { formatMoney, variantLabel } from "@/lib/format";
import type { Sale } from "@/lib/types";

import { SALES_RANGES, type SalesRange } from "@/lib/sales-range";
import { useT } from "@/i18n/client";

export function SalesView({
  sales, stores, peopleNames, pendingVoidIds, isOwner, range, store,
}: {
  sales: Sale[]; stores: { id: string; name: string }[]; peopleNames: Record<string, string>;
  pendingVoidIds: string[]; isOwner: boolean; range: SalesRange; store?: string;
}) {
  const t = useT();
  const storeName = new Map(stores.map((s) => [s.id, s.name]));
  const pendingSet = new Set(pendingVoidIds);
  const valid = sales.filter((s) => !s.voided_at);
  const total = valid.reduce((n, s) => n + s.total_cents, 0);
  const units = valid.reduce((n, s) => n + s.quantity, 0);
  const qs = (patch: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    const merged = { store, range, ...patch };
    for (const [k, v] of Object.entries(merged)) if (v) p.set(k, v);
    return `/sales?${p}`;
  };

  return (
    <div className="grid gap-4">
      <h1 className="text-2xl font-semibold">{t("nav.sales")}</h1>
      <form className="flex flex-wrap gap-2" action="/sales">
        <select name="store" defaultValue={store ?? ""} className="h-10 rounded-md border bg-background px-3">
          <option value="">{t("common.allStores")}</option>
          {stores.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <input type="hidden" name="range" value={range} />
        <button className="h-10 rounded-md border px-4 text-sm font-medium" type="submit">{t("common.apply")}</button>
        <div className="flex gap-1">
          {(Object.keys(SALES_RANGES) as SalesRange[]).map((r) => (
            <a key={r} href={qs({ range: r })}
              className={`flex h-10 items-center rounded-md border px-3 text-sm ${r === range ? "bg-foreground text-background" : ""}`}>
              {r === "today" ? t("sales.rangeToday") : r === "7d" ? t("sales.range7d") : t("sales.range30d")}
            </a>
          ))}
        </div>
      </form>

      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-lg border p-3"><div className="text-xs text-muted-foreground">{t("sales.revenue")}</div><div className="text-lg font-semibold">{formatMoney(total)}</div></div>
        <div className="rounded-lg border p-3"><div className="text-xs text-muted-foreground">{t("sales.units")}</div><div className="text-lg font-semibold">{units}</div></div>
        <div className="rounded-lg border p-3"><div className="text-xs text-muted-foreground">{t("nav.sales")}</div><div className="text-lg font-semibold">{valid.length}</div></div>
      </div>

      {sales.length === 0 ? (
        <p className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">{t("sales.empty")}</p>
      ) : (
        <ul className="divide-y rounded-lg border bg-card">
          {sales.map((s) => {
            const v = variantLabel(s.size, s.color);
            const label = `${s.quantity} × ${s.item_name}${v ? ` (${v})` : ""}`;
            return (
              <li key={s.id} className="flex items-center gap-3 px-3 py-3">
                <div className="min-w-0 flex-1">
                  <div className={`font-medium ${s.voided_at ? "line-through text-muted-foreground" : ""}`}>{label}</div>
                  <div className="text-xs text-muted-foreground">
                    <LocalTime iso={s.created_at} /> · {storeName.get(s.store_id)} · {peopleNames[s.sold_by] ?? "—"}
                    {s.voided_at && <span className="ms-1 font-medium text-red-700">· {t("sales.voided")}</span>}
                  </div>
                </div>
                <div className="text-end">
                  <div className="font-semibold">{formatMoney(s.total_cents)}</div>
                  <div className="text-xs text-muted-foreground">{t("sales.each", { price: formatMoney(s.unit_price_cents) })}</div>
                </div>
                {!s.voided_at && (
                  <SaleRowActions saleId={s.id} label={label} isOwner={isOwner} pendingRequest={pendingSet.has(s.id)} />
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
