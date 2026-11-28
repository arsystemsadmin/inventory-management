"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, X } from "lucide-react";
import { LocalTime } from "@/components/local-time";
import { SaleRowActions } from "@/components/sales/sale-row-actions";
import { PaymentBadge } from "@/components/sales/payment-badge";
import { SaleProofButton } from "@/components/sales/sale-proof-button";
import { SalesChart } from "@/components/sales/sales-chart";
import { CollapsibleSection } from "@/components/ui/collapsible-section";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { formatMoney, variantLabel } from "@/lib/format";
import { PAYMENT_METHODS, type PaymentMethod, type Sale } from "@/lib/types";
import { SALES_RANGES, type SalesRange } from "@/lib/sales-range";
import { useT } from "@/i18n/client";

type Status = "active" | "voided" | "all";
type Sort = "newest" | "oldest" | "highest" | "lowest";
const PAGE = 15;

const cashOf = (s: Sale) => s.cash_cents ?? (s.payment_method === "credit" || s.payment_method === "other" ? 0 : s.total_cents);
const creditOf = (s: Sale) => s.credit_cents ?? (s.payment_method === "credit" ? s.total_cents : 0);
const otherOf = (s: Sale) => s.other_cents ?? (s.payment_method === "other" ? s.total_cents : 0);

export function SalesView({
  sales, stores, peopleNames, pendingVoidIds, isOwner, range, store, asOf,
}: {
  sales: Sale[]; stores: { id: string; name: string }[]; peopleNames: Record<string, string>;
  pendingVoidIds: string[]; isOwner: boolean; range: SalesRange; store?: string; asOf: string;
}) {
  const t = useT();
  const router = useRouter();
  const storeName = new Map(stores.map((s) => [s.id, s.name]));
  const pendingSet = new Set(pendingVoidIds);

  // Filters that work on the loaded period (no reload needed).
  const [q, setQ] = useState("");
  const [seller, setSeller] = useState("");
  const [payment, setPayment] = useState<PaymentMethod | "">("");
  const [status, setStatus] = useState<Status>("active");
  const [sort, setSort] = useState<Sort>("newest");
  const [limit, setLimit] = useState(PAGE);

  const sellers = useMemo(
    () => Array.from(new Set(sales.map((s) => s.sold_by)))
      .map((id) => ({ id, name: peopleNames[id] ?? "—" }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    [sales, peopleNames],
  );

  // Everything except status: totals and the chart always use non-voided sales.
  const matching = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return sales.filter((s) =>
      (!seller || s.sold_by === seller)
      && (!payment || (s.payment_method ?? "cash") === payment)
      && (!needle || [s.item_name, s.size, s.color, s.payment_other].some((x) => x?.toLowerCase().includes(needle))));
  }, [sales, q, seller, payment]);
  const valid = useMemo(() => matching.filter((s) => !s.voided_at), [matching]);
  const voided = matching.filter((s) => s.voided_at);

  const list = useMemo(() => {
    const rows = matching.filter((s) => status === "all" || (status === "voided" ? !!s.voided_at : !s.voided_at));
    const by: Record<Sort, (a: Sale, b: Sale) => number> = {
      newest: (a, b) => b.created_at.localeCompare(a.created_at),
      oldest: (a, b) => a.created_at.localeCompare(b.created_at),
      highest: (a, b) => b.total_cents - a.total_cents,
      lowest: (a, b) => a.total_cents - b.total_cents,
    };
    return [...rows].sort(by[sort]);
  }, [matching, status, sort]);

  const total = valid.reduce((n, s) => n + s.total_cents, 0);
  const units = valid.reduce((n, s) => n + s.quantity, 0);
  const cashTotal = valid.reduce((n, s) => n + cashOf(s), 0);
  const creditTotal = valid.reduce((n, s) => n + creditOf(s), 0);
  const otherTotal = valid.reduce((n, s) => n + otherOf(s), 0);
  // "Other" totals per method name (Bit, bank transfer…).
  const otherByName = [...valid.filter((s) => otherOf(s) > 0).reduce((m, s) => {
    const k = s.payment_other?.trim() || "—";
    return m.set(k, (m.get(k) ?? 0) + otherOf(s));
  }, new Map<string, number>())];
  const avg = valid.length ? Math.round(total / valid.length) : 0;

  const group = (key: (s: Sale) => string, name: (k: string, s: Sale) => string) => {
    const m = new Map<string, { name: string; revenue: number; units: number; count: number }>();
    for (const s of valid) {
      const k = key(s);
      const g = m.get(k) ?? { name: name(k, s), revenue: 0, units: 0, count: 0 };
      g.revenue += s.total_cents; g.units += s.quantity; g.count += 1;
      m.set(k, g);
    }
    return [...m.values()].sort((a, b) => b.revenue - a.revenue);
  };
  const topProducts = group((s) => `${s.store_id}|${s.item_name.toLowerCase()}`, (_, s) => s.item_name).slice(0, 5);
  const topVariations = group((s) => `${s.item_id}`, (_, s) => `${s.item_name}${variantLabel(s.size, s.color) ? ` · ${variantLabel(s.size, s.color)}` : ""}`).slice(0, 5);
  const bySeller = group((s) => s.sold_by, (k) => peopleNames[k] ?? "—");
  const byStore = !store && stores.length > 1 ? group((s) => s.store_id, (k) => storeName.get(k) ?? "—") : [];

  const go = (patch: { store?: string; range?: string }) => {
    const p = new URLSearchParams();
    const merged = { store: store ?? "", range, ...patch };
    // Always send store (empty = all stores) so the active-store default doesn't override a choice.
    p.set("store", merged.store);
    p.set("range", merged.range);
    router.push(`/sales?${p}`);
  };
  const filtersOn = q || seller || payment || status !== "active";
  const clear = () => { setQ(""); setSeller(""); setPayment(""); setStatus("active"); };

  const tile = (label: string, value: string, sub?: string) => (
    <div className="rounded-lg border bg-card p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-lg font-semibold tabular-nums">{value}</div>
      {sub && <div className="text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
  const ranking = (title: string, rows: { name: string; revenue: number; units: number; count: number }[]) => {
    const top = rows[0]?.revenue ?? 0;
    return (
      <div>
        <h3 className="mb-2 text-sm font-semibold">{title}</h3>
        {rows.length === 0 ? <p className="text-sm text-muted-foreground">{t("sales.empty")}</p> : (
          <ul className="grid gap-2">
            {rows.map((r) => (
              <li key={r.name} className="grid gap-1">
                <div className="flex items-baseline justify-between gap-2 text-sm">
                  <bdi className="truncate">{r.name}</bdi>
                  <span className="shrink-0 tabular-nums"><b>{formatMoney(r.revenue)}</b> <span className="text-xs text-muted-foreground">· {t("salesChart.unitsShort", { count: r.units })}</span></span>
                </div>
                <div className="h-1.5 rounded-full bg-muted">
                  <div className="h-full rounded-full bg-emerald-600 dark:bg-emerald-400" style={{ width: `${top ? (r.revenue / top) * 100 : 0}%` }} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  };

  return (
    <div className="grid grid-cols-1 gap-4">
      <h1 className="text-2xl font-semibold">{t("nav.sales")}</h1>

      {/* Period + store (reloads) */}
      <div className="flex flex-wrap gap-2">
        {stores.length > 1 && (
          <NativeSelect value={store ?? ""} onChange={(e) => go({ store: e.target.value })} aria-label={t("dashboard.store")} className="w-auto min-w-40">
            <option value="">{t("common.allStores")}</option>
            {stores.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </NativeSelect>
        )}
        <div className="flex flex-wrap gap-1">
          {(Object.keys(SALES_RANGES) as SalesRange[]).map((r) => (
            <button key={r} type="button" onClick={() => go({ range: r })} aria-pressed={r === range}
              className={`flex h-10 items-center rounded-md border px-3 text-sm ${r === range ? "bg-foreground text-background" : "bg-background"}`}>
              {t(`sales.range_${r}`)}
            </button>
          ))}
        </div>
      </div>

      {/* Refine (instant) */}
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-[1fr_auto_auto_auto_auto] lg:items-center">
        <div className="relative col-span-2 lg:col-span-1">
          <Search className="absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("sales.searchPlaceholder")} className="ps-9" />
        </div>
        <NativeSelect value={seller} onChange={(e) => setSeller(e.target.value)} aria-label={t("sales.seller")}>
          <option value="">{t("sales.allSellers")}</option>
          {sellers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </NativeSelect>
        <NativeSelect value={payment} onChange={(e) => setPayment(e.target.value as PaymentMethod | "")} aria-label={t("sales.paymentFilter")}>
          <option value="">{t("sales.allPayments")}</option>
          {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{t(`payment.${m}`)}</option>)}
        </NativeSelect>
        <NativeSelect value={status} onChange={(e) => setStatus(e.target.value as Status)} aria-label={t("sales.statusFilter")}>
          <option value="active">{t("sales.status_active")}</option>
          <option value="voided">{t("sales.status_voided")}</option>
          <option value="all">{t("sales.status_all")}</option>
        </NativeSelect>
        <NativeSelect value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label={t("sales.sort")}>
          <option value="newest">{t("sales.sort_newest")}</option>
          <option value="oldest">{t("sales.sort_oldest")}</option>
          <option value="highest">{t("sales.sort_highest")}</option>
          <option value="lowest">{t("sales.sort_lowest")}</option>
        </NativeSelect>
      </div>
      {filtersOn && (
        <button type="button" onClick={clear} className="inline-flex w-fit items-center gap-1 text-sm text-muted-foreground underline">
          <X className="size-3.5" /> {t("sales.clearFilters")}
        </button>
      )}

      {/* The list comes first; the rest folds away. */}
      <CollapsibleSection
        storageKey="sales-list"
        title={t("sales.allSales")}
        summary={`${formatMoney(total)} · ${t("sales.countSales", { count: valid.length })}`}
      >
        {list.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            {sales.length === 0 ? t("sales.empty") : t("inventory.noMatch")}
          </p>
        ) : (
          <>
            <ul className="-mx-4 -my-3 divide-y">
              {list.slice(0, limit).map((s) => {
                const v = variantLabel(s.size, s.color);
                const label = `${s.quantity} × ${s.item_name}${v ? ` (${v})` : ""}`;
                return (
                  <li key={s.id} className="flex items-center gap-3 px-4 py-2.5">
                    <div className="min-w-0 flex-1">
                      <div className={`line-clamp-2 font-medium ${s.voided_at ? "line-through text-muted-foreground" : ""}`}>{label}</div>
                      <div className="flex flex-wrap items-center gap-x-1 text-xs text-muted-foreground">
                        <LocalTime iso={s.created_at} /> · {storeName.get(s.store_id)} · {peopleNames[s.sold_by] ?? "—"}
                        {s.voided_at && <span className="font-medium text-red-700">· {t("sales.voided")}</span>}
                        <PaymentBadge method={s.payment_method} cashCents={s.cash_cents} creditCents={s.credit_cents} otherName={s.payment_other} showAmounts className="ms-1" />
                      </div>
                    </div>
                    <div className="text-end">
                      <div className="font-semibold tabular-nums">{formatMoney(s.total_cents)}</div>
                      {s.quantity > 1 && <div className="text-xs text-muted-foreground">{t("sales.each", { price: formatMoney(s.unit_price_cents) })}</div>}
                    </div>
                    <SaleProofButton sale={s} label={label} />
                    {!s.voided_at && (
                      <SaleRowActions saleId={s.id} label={label} isOwner={isOwner} pendingRequest={pendingSet.has(s.id)} />
                    )}
                  </li>
                );
              })}
            </ul>
            <div className="mt-3 flex items-center justify-between gap-2 border-t pt-3">
              <span className="text-xs text-muted-foreground">{t("sales.showingOf", { shown: Math.min(limit, list.length), count: list.length })}</span>
              {list.length > limit && (
                <Button variant="outline" size="sm" onClick={() => setLimit((n) => n + PAGE)}>{t("sales.showMore")}</Button>
              )}
            </div>
          </>
        )}
      </CollapsibleSection>

      <CollapsibleSection storageKey="sales-summary" title={t("sales.summary")}>
        <div className="grid gap-3">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {tile(t("sales.revenue"), formatMoney(total))}
            {tile(t("sales.units"), String(units))}
            {tile(t("salesChart.salesCount"), String(valid.length))}
            {tile(t("sales.avgSale"), formatMoney(avg))}
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
            <span className="inline-flex items-center gap-1"><PaymentBadge method="cash" /> <b className="tabular-nums">{formatMoney(cashTotal)}</b></span>
            <span className="inline-flex items-center gap-1"><PaymentBadge method="credit" /> <b className="tabular-nums">{formatMoney(creditTotal)}</b></span>
            {otherTotal > 0 && otherByName.map(([name, cents]) => (
              <span key={name} className="inline-flex items-center gap-1"><PaymentBadge method="other" otherName={name} /> <b className="tabular-nums">{formatMoney(cents)}</b></span>
            ))}
            {voided.length > 0 && (
              <span className="text-muted-foreground">
                {t("sales.voidedSummary", { count: voided.length, amount: formatMoney(voided.reduce((n, s) => n + s.total_cents, 0)) })}
              </span>
            )}
          </div>
        </div>
      </CollapsibleSection>

      <CollapsibleSection storageKey="sales-chart" title={t("sales.overTime")}>
        <SalesChart key={range} sales={valid} range={range} asOf={asOf} />
      </CollapsibleSection>

      <CollapsibleSection storageKey="sales-breakdowns" title={t("sales.breakdowns")} defaultOpen={false}>
        <div className="grid gap-5 md:grid-cols-2">
          {ranking(t("sales.topProducts"), topProducts)}
          {ranking(t("sales.topVariations"), topVariations)}
          {(isOwner || bySeller.length > 1) && ranking(t("sales.bySeller"), bySeller)}
          {byStore.length > 0 && ranking(t("sales.byStore"), byStore)}
        </div>
      </CollapsibleSection>
    </div>
  );
}
