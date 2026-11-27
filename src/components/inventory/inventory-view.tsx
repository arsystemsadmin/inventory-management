"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, PackagePlus, Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { StockBadge } from "@/components/stock-badge";
import { cn } from "@/lib/utils";
import { formatMoney, STOCK_ORDER, variantLabel } from "@/lib/format";
import { groupProducts, type Product } from "@/lib/products";
import { STOCK_STATUSES, type Item, type Role, type StockStatus } from "@/lib/types";
import { SellDialog } from "./sell-dialog";
import { ItemFormDialog } from "./item-form-dialog";
import { ItemThumb } from "./item-thumb";
import { QuantityDialog } from "./quantity-dialog";
import { colorHref, colorKey, productHref } from "@/lib/product-links";
import { useActiveStore } from "@/lib/active-store";
import { useT } from "@/i18n/client";

export type InventoryStore = { id: string; business_id: string; name: string; inventory_locked_at: string | null; status: string };

/**
 * Inventory grouped by product: each card is one product with all of its
 * variations (size/color) underneath. Selling starts from the product and
 * asks only which variation and how many.
 */
export function InventoryView({
  items, stores, role, fixedStoreId, initialStatus,
}: {
  items: Item[];
  stores: InventoryStore[];
  role: Role;
  fixedStoreId?: string;
  initialStatus?: StockStatus | "ALERTS";
}) {
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("");
  const [status, setStatus] = useState<StockStatus | "ALERTS" | "">(initialStatus === "ALERTS" ? "" : initialStatus ?? "");
  // Products = the full inventory; Restock = only what's out or running low.
  const [view, setView] = useState<"products" | "restock">(initialStatus === "ALERTS" ? "restock" : "products");
  // Opens on the store you're working in; switching stores in the top bar follows.
  const { activeStoreId } = useActiveStore();
  const startStore = fixedStoreId ?? (stores.some((s) => s.id === activeStoreId) ? activeStoreId : "");
  const [storeId, setStoreId] = useState(startStore);
  useEffect(() => { if (!fixedStoreId) setStoreId(startStore); }, [startStore, fixedStoreId]);
  const [showArchived, setShowArchived] = useState(false);
  const [selling, setSelling] = useState<{ item: Item; variants: Item[] } | null>(null);
  const [adding, setAdding] = useState(false);
  const [settingQty, setSettingQty] = useState<Item | null>(null);
  const t = useT();

  const isOwner = role === "owner";
  const storeById = useMemo(() => new Map(stores.map((s) => [s.id, s])), [stores]);
  const needsApproval = (sid: string) => !isOwner && !!storeById.get(sid)?.inventory_locked_at;
  const editableStores = stores.filter((s) => s.status !== "closed");

  const scoped = useMemo(
    () => items.filter((i) => (storeId ? i.store_id === storeId : true) && i.archived === showArchived),
    [items, storeId, showArchived],
  );
  const categories = useMemo(
    () => Array.from(new Set(items.map((i) => i.category).filter(Boolean) as string[])).sort(),
    [items],
  );
  // Counts are per variation: that's what runs out.
  const counts = useMemo(() => {
    const c: Record<StockStatus, number> = { OUT: 0, CRITICAL: 0, LOW: 0, OK: 0 };
    scoped.forEach((i) => c[i.stock_status]++);
    return c;
  }, [scoped]);
  const alerts = counts.OUT + counts.CRITICAL + counts.LOW;

  const products = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const statusOk = (i: Item) => !status || (status === "ALERTS" ? i.stock_status !== "OK" : i.stock_status === status);
    return groupProducts(scoped)
      .filter((p) => !category || p.category === category)
      .map((p) => {
        // Product name/category match shows all variations; otherwise only matching ones.
        const productMatch = !needle || [p.name, p.category].some((v) => v?.toLowerCase().includes(needle));
        const variants = p.variants.filter((v) => statusOk(v) &&
          (productMatch || [v.sku, v.size, v.color].some((x) => x?.toLowerCase().includes(needle))));
        return { product: p, variants };
      })
      .filter((x) => x.variants.length > 0);
  }, [scoped, q, category, status]);

  const totalProducts = useMemo(() => groupProducts(scoped).length, [scoped]);

  // Restock list: every variation that's out, critical or low (never removed
  // items), grouped by product, worst first. Store, category and search apply.
  const restock = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const active = items.filter((i) => (storeId ? i.store_id === storeId : true) && !i.archived);
    return groupProducts(active)
      .filter((p) => !category || p.category === category)
      .map((p) => {
        const productMatch = !needle || [p.name, p.category].some((v) => v?.toLowerCase().includes(needle));
        const variants = p.variants
          .filter((v) => v.stock_status !== "OK" &&
            (productMatch || [v.sku, v.size, v.color].some((x) => x?.toLowerCase().includes(needle))))
          .sort((a, b) => STOCK_ORDER[a.stock_status] - STOCK_ORDER[b.stock_status] || a.quantity - b.quantity);
        return { product: p, variants };
      })
      .filter((x) => x.variants.length > 0)
      .sort((a, b) => STOCK_ORDER[a.variants[0].stock_status] - STOCK_ORDER[b.variants[0].stock_status]
        || b.variants.filter((v) => v.quantity <= 0).length - a.variants.filter((v) => v.quantity <= 0).length
        || a.product.name.localeCompare(b.product.name));
  }, [items, storeId, category, q]);
  const restockCount = restock.reduce((n, r) => n + r.variants.length, 0);

  // Per color: name, whether every size is out, whether some are, whether any are low.
  const colorSummary = (variants: Item[]) => {
    const map = new Map<string, Item[]>();
    for (const v of variants) {
      const k = colorKey(v.color);
      const list = map.get(k);
      if (list) list.push(v); else map.set(k, [v]);
    }
    return [...map.entries()].map(([key, vs]) => ({
      key,
      label: vs[0].color ?? t("common.noColor"),
      out: vs.every((v) => v.quantity <= 0),
      someOut: vs.some((v) => v.quantity <= 0),
      warn: vs.some((v) => v.stock_status !== "OK"),
    })).sort((x, y) => Number(x.out) - Number(y.out) || x.label.localeCompare(y.label));
  };

  const startSale = (p: Product) => {
    const active = items.filter((i) => i.store_id === p.store_id && !i.archived && i.name === p.name);
    const first = [...active].sort((a, b) => Number(b.quantity > 0) - Number(a.quantity > 0))[0];
    if (first) setSelling({ item: first, variants: active });
  };

  return (
    <div className="grid gap-4">
      {alerts > 0 && !showArchived && (
        <button
          type="button"
          onClick={() => { setStatus(""); setView(view === "restock" ? "products" : "restock"); }}
          className="flex items-center gap-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2.5 text-start text-sm text-amber-900"
        >
          <AlertTriangle className="size-5 shrink-0 text-amber-600" />
          <span className="flex-1">
            <b>{t("inventory.needRestocking", { count: alerts })}</b>
            {" — "}{t("inventory.alertBreakdown", { out: counts.OUT, critical: counts.CRITICAL, low: counts.LOW })}
          </span>
          <span className="underline shrink-0">{view === "restock" ? t("inventory.showAll") : t("inventory.show")}</span>
        </button>
      )}

      <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto] sm:items-center">
        <div className="relative">
          <Search className="absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("inventory.searchPlaceholder")} className="ps-9" />
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex">
          {!fixedStoreId && stores.length > 1 && (
            <NativeSelect value={storeId} onChange={(e) => setStoreId(e.target.value)} aria-label={t("dashboard.store")} className="sm:w-48">
              <option value="">{t("common.allStores")}</option>
              {stores.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </NativeSelect>
          )}
          <NativeSelect value={category} onChange={(e) => setCategory(e.target.value)} aria-label={t("fields.category")} className="sm:w-40">
            <option value="">{t("inventory.allCategories")}</option>
            {categories.map((c) => <option key={c} value={c}>{c}</option>)}
          </NativeSelect>
        </div>
        {editableStores.length > 0 && (
          <Button size="lg" onClick={() => setAdding(true)}><Plus /> {t("inventory.addProduct")}</Button>
        )}
      </div>

      <div role="tablist" className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1">
        {(["products", "restock"] as const).map((v) => (
          <button
            key={v}
            type="button"
            role="tab"
            aria-selected={view === v}
            onClick={() => setView(v)}
            className={cn(
              "flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium",
              view === v ? "bg-background shadow-sm" : "text-muted-foreground",
            )}
          >
            {v === "products" ? t("inventory.productsTab") : t("inventory.restockTab")}
            {v === "restock" && restockCount > 0 && (
              <span className="rounded-full bg-red-600 px-1.5 text-xs font-semibold text-white">{restockCount}</span>
            )}
          </button>
        ))}
      </div>

      {view === "restock" ? (
        restock.length === 0 ? (
          <div className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">
            {q.trim() || category ? t("inventory.noMatch") : t("inventory.restockEmpty")}
          </div>
        ) : (
          <div className="grid gap-3">
            <p className="text-sm text-muted-foreground">{t("inventory.restockNote")}</p>
            <ul className="grid gap-3">
              {restock.map(({ product: p, variants }) => {
                const store = storeById.get(p.store_id);
                const closed = store?.status === "closed";
                return (
                  <li key={p.key} className="overflow-hidden rounded-xl border bg-card">
                    <div className="flex items-center gap-3 border-b p-3">
                      <ItemThumb path={p.image_path} alt={p.name} className="size-12" />
                      <div className="min-w-0 flex-1">
                        <bdi className="block truncate font-semibold">{p.name}</bdi>
                        <span className="block truncate text-xs text-muted-foreground">
                          {[!fixedStoreId && stores.length > 1 ? store?.name : null, p.category].filter(Boolean).join(" · ")}
                        </span>
                      </div>
                      <span className="shrink-0 text-xs text-muted-foreground">{t("inventory.toRestock", { count: variants.length })}</span>
                    </div>
                    <ul className="divide-y">
                      {variants.map((v) => (
                        <li key={v.id} className={cn("flex items-center gap-3 px-3 py-2.5", v.quantity <= 0 && "bg-red-50/60 dark:bg-red-950/20")}>
                          <ItemThumb path={v.variation_image_path ?? v.variant_image_path ?? p.image_path} alt={p.name} className="size-10" />
                          <div className="min-w-0 flex-1">
                            <Link href={colorHref(v.id)} className="block truncate text-sm font-medium hover:underline">{variantLabel(v.size, v.color) || t("common.standard")}</Link>
                            <span className="block text-xs text-muted-foreground">
                              {t("inventory.leftOf", { count: v.quantity, threshold: v.low_stock_threshold })}
                            </span>
                          </div>
                          <StockBadge status={v.stock_status} />
                          {!closed && (
                            <Button size="sm" variant="outline" onClick={() => setSettingQty(v)}>
                              <PackagePlus /> {t("inventory.addStock")}
                            </Button>
                          )}
                        </li>
                      ))}
                    </ul>
                  </li>
                );
              })}
            </ul>
          </div>
        )
      ) : (<>
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4 sm:mx-0 sm:px-0">
        {(["", ...STOCK_STATUSES] as const).map((s) => (
          <button
            key={s || "all"}
            type="button"
            onClick={() => setStatus(s)}
            className={cn(
              "shrink-0 rounded-full border px-3 py-1.5 text-sm font-medium",
              status === s ? "bg-foreground text-background border-foreground" : "bg-background",
            )}
          >
            {s === "" ? `${t("inventory.all")} (${totalProducts})` : `${t(`stock.${s}`)} (${counts[s]})`}
          </button>
        ))}
        {isOwner && (
          <button type="button" onClick={() => setShowArchived((v) => !v)}
            className={cn("shrink-0 rounded-full border px-3 py-1.5 text-sm", showArchived && "bg-muted font-medium")}>
            {showArchived ? t("inventory.showingRemoved") : t("inventory.removedItems")}
          </button>
        )}
      </div>

      {products.length === 0 ? (
        <div className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">
          {items.length === 0 ? t("inventory.empty") : t("inventory.noMatch")}
        </div>
      ) : (
        <ul className="grid gap-2">
          {products.map(({ product: p }) => {
            const store = storeById.get(p.store_id);
            const closed = store?.status === "closed";
            const price = p.minPrice === p.maxPrice ? formatMoney(p.minPrice) : `${formatMoney(p.minPrice)}–${formatMoney(p.maxPrice)}`;
            // One short line of colors: the first few, then "+N".
            const colors = colorSummary(p.variants);
            const shown = colors.slice(0, 3);
            return (
              <li key={p.key} className="rounded-xl border bg-card">
                <div className="flex items-start gap-3 p-3">
                  <Link href={productHref(p.variants[0].id)} aria-label={t("product.open", { name: p.name })}
                    className="flex min-w-0 flex-1 items-start gap-3">
                    <ItemThumb path={p.image_path} alt={p.name} className="size-16 shrink-0" />
                    <div className="grid min-w-0 flex-1 gap-0.5">
                      <div className="flex min-w-0 items-center gap-2">
                        <bdi className="truncate font-semibold">{p.name}</bdi>
                        {p.status !== "OK" && <StockBadge status={p.status} className="shrink-0" />}
                      </div>
                      <div className="text-sm">
                        <span className="font-semibold tabular-nums">{price}</span>
                        <span className="ms-2 text-muted-foreground">{t("sell.inStock", { count: p.quantity })}</span>
                      </div>
                      <div className="truncate text-xs text-muted-foreground">
                        {t("inventory.colors", { count: colors.length })} · {t("product.variationsCount", { count: p.variants.length })}
                        {p.status !== "OUT" && p.outCount > 0 && (
                          <span className="font-semibold text-red-700"> · {t("inventory.soldOutCount", { count: p.outCount })}</span>
                        )}
                        {!fixedStoreId && stores.length > 1 && store ? ` · ${store.name}` : ""}
                      </div>
                      {colors.length > 1 && (
                        <div className="mt-1 flex min-w-0 gap-1 overflow-hidden">
                          {shown.map((c) => (
                            <span key={c.key} className={cn(
                              "inline-flex min-w-0 max-w-[8rem] shrink items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium ring-1 ring-border",
                              c.out ? "bg-red-50 text-red-700 line-through" : c.warn ? "bg-amber-50 text-amber-800" : "bg-background",
                            )}>
                              {!c.out && c.someOut && <span className="size-1.5 shrink-0 rounded-full bg-red-600" aria-hidden />}
                              <bdi className="truncate">{c.label}</bdi>
                            </span>
                          ))}
                          {colors.length > shown.length && (
                            <span className="shrink-0 rounded px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground ring-1 ring-border">
                              {t("product.moreColors", { count: colors.length - shown.length })}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </Link>
                  {!showArchived && (
                    <Button size="lg" variant="success" className="min-w-20 shrink-0" disabled={p.quantity === 0 || closed} onClick={() => startSale(p)}>
                      {t("inventory.sell")}
                    </Button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
      </>)}

      <SellDialog item={selling?.item ?? null} variants={selling?.variants ?? []} onClose={() => setSelling(null)} />
      <ItemFormDialog
        open={adding}
        onClose={() => setAdding(false)}
        stores={editableStores}
        defaultStoreId={fixedStoreId || storeId || undefined}
        needsApproval={needsApproval}
        categories={categories}
      />
      <QuantityDialog
        item={settingQty}
        onClose={() => setSettingQty(null)}
        needsApproval={settingQty ? needsApproval(settingQty.store_id) : false}
      />
    </div>
  );
}

export function sortByUrgency(items: Item[]) {
  return [...items].sort((a, b) => STOCK_ORDER[a.stock_status] - STOCK_ORDER[b.stock_status]);
}
