"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { AlertTriangle, ChevronDown, ChevronRight, MoreHorizontal, PackagePlus, Pencil, Plus, Search } from "lucide-react";
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
import { ItemActionsDialog } from "./item-actions-dialog";
import { ItemThumb } from "./item-thumb";
import { ProductEditDialog } from "./product-edit-dialog";
import { QuantityDialog } from "./quantity-dialog";
import { SizePhotoButton } from "./photo-field";
import { useActions } from "@/lib/actions-context";
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
  const [acting, setActing] = useState<Item | null>(null);
  const [editing, setEditing] = useState<Item | null>(null);
  const [addingTo, setAddingTo] = useState<Product | null>(null);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [adding, setAdding] = useState(false);
  const [settingQty, setSettingQty] = useState<Item | null>(null);
  // Products start collapsed; tap a card to see its sizes and colors.
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const toggle = (key: string) =>
    setExpanded((prev) => { const n = new Set(prev); if (n.has(key)) n.delete(key); else n.add(key); return n; });
  // While searching or filtering by stock, show what matched.
  const autoOpen = q.trim() !== "" || status !== "";
  const actions = useActions();
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

  // Group a product's (visible) variations by color; sizes stay in size order inside each color.
  const byColor = (variants: Item[]) => {
    const map = new Map<string, { color: string | null; variants: Item[] }>();
    for (const v of variants) {
      const k = (v.color ?? "").trim().toLowerCase();
      const g = map.get(k);
      if (g) g.variants.push(v); else map.set(k, { color: v.color, variants: [v] });
    }
    return [...map.values()].sort((x, y) => (x.color ?? "").localeCompare(y.color ?? ""));
  };
  const sameColor = (v: Item, color: string | null) => (v.color ?? "").trim().toLowerCase() === (color ?? "").trim().toLowerCase();

  // A color photo is shared by every size of that color.
  const setColorPhoto = async (p: Product, color: string | null, path: string | null) => {
    for (const v of p.variants.filter((x) => sameColor(x, color))) {
      const res = await actions.saveItemEdit({ itemId: v.id, changes: { variant_image_path: path } });
      if (!res.ok) { toast.error(res.error); return; }
    }
    const label = color ?? t("common.noColor");
    toast.success(path ? t("inventory.photoSaved", { label }) : t("inventory.photoRemoved", { label }));
  };

  // A variation photo belongs to one size + color only.
  const setVariationPhoto = async (v: Item, path: string | null) => {
    const res = await actions.saveItemEdit({ itemId: v.id, changes: { variation_image_path: path } });
    if (!res.ok) { toast.error(res.error); return; }
    const label = [v.size, v.color].filter(Boolean).join(" · ") || t("inventory.thisVariation");
    toast.success(path ? t("inventory.photoSaved", { label }) : t("inventory.photoRemoved", { label }));
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
                            <Link href={`/inventory/${v.id}`} className="block truncate text-sm font-medium hover:underline">{variantLabel(v.size, v.color) || t("common.standard")}</Link>
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
        <ul className="grid gap-3">
          {products.map(({ product: p, variants }) => {
            const store = storeById.get(p.store_id);
            const closed = store?.status === "closed";
            const price = p.minPrice === p.maxPrice ? formatMoney(p.minPrice) : `${formatMoney(p.minPrice)}–${formatMoney(p.maxPrice)}`;
            const isOpen = autoOpen || expanded.has(p.key);
            // Collapsed summary: one chip per color (red = sold out, amber = running low).
            const colorSummary = byColor(p.variants).map((g) => ({
              label: g.color ?? t("common.noColor"),
              qty: g.variants.reduce((n, v) => n + v.quantity, 0),
              warn: g.variants.some((v) => v.stock_status !== "OK"),
              someOut: g.variants.some((v) => v.quantity <= 0),
            }));
            return (
              <li key={p.key} className="overflow-hidden rounded-xl border bg-card">
                <div className="flex items-center gap-3 p-3">
                  <button
                    type="button"
                    onClick={() => toggle(p.key)}
                    aria-expanded={isOpen}
                    aria-label={isOpen ? t("inventory.hideVariations", { name: p.name }) : t("inventory.showVariations", { name: p.name })}
                    className="flex min-w-0 flex-1 items-center gap-3 text-start"
                  >
                  <ItemThumb path={p.image_path} alt={p.name} className="size-14" />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="font-semibold">{p.name}</span>
                      {p.status !== "OK" && <StockBadge status={p.status} />}
                      {p.status !== "OUT" && p.outCount > 0 && (
                        <span className="inline-flex items-center gap-1 rounded-md border border-red-300 bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-700">
                          <span className="size-1.5 rounded-full bg-red-600" aria-hidden />
                          {t("inventory.soldOutCount", { count: p.outCount })}
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 text-xs text-muted-foreground">
                      {[p.category, !fixedStoreId && stores.length > 1 ? store?.name : null,
                        `${p.variants.length} variation${p.variants.length === 1 ? "" : "s"}`].filter(Boolean).join(" · ")}
                    </div>
                    <div className="mt-0.5 text-sm">
                      <span className="font-semibold">{price}</span>
                      <span className="ms-2 text-muted-foreground">{t("sell.inStock", { count: p.quantity })}</span>
                    </div>
                    {!isOpen && (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {colorSummary.map((sz) => (
                          <span key={sz.label} className={cn(
                            "inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-semibold ring-1 ring-border",
                            sz.qty === 0 ? "bg-red-50 text-red-700 line-through" : sz.warn ? "bg-amber-50 text-amber-800" : "bg-background",
                          )}>
                            {/* a red dot = some sizes of this color are sold out */}
                            {sz.qty > 0 && sz.someOut && <span className="size-1.5 rounded-full bg-red-600" aria-hidden />}
                            {sz.label}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <ChevronDown className={cn("size-5 shrink-0 text-muted-foreground transition-transform", isOpen && "rotate-180")} aria-hidden />
                  </button>
                  {!showArchived && (
                    <Button size="lg" variant="success" className="min-w-20" disabled={p.quantity === 0 || closed} onClick={() => startSale(p)}>
                      {t("inventory.sell")}
                    </Button>
                  )}
                </div>

                {isOpen && (<>
                <ul className="divide-y border-t">
                  {byColor(variants).map((g) => {
                    const colorPhoto = p.variants.find((v) => sameColor(v, g.color) && v.variant_image_path)?.variant_image_path;
                    const total = g.variants.reduce((n, v) => n + v.quantity, 0);
                    return (
                      <li key={g.color ?? "none"} className="bg-muted/20">
                        <div className="flex items-center gap-2.5 px-3 pt-2 pb-1">
                          {!showArchived ? (
                            <SizePhotoButton
                              value={colorPhoto}
                              label={g.color ?? t("common.noColor")}
                              businessId={p.variants[0].business_id}
                              storeId={p.store_id}
                              onChange={(path) => setColorPhoto(p, g.color, path)}
                              className="size-9"
                            />
                          ) : null}
                          <bdi className="rounded-md bg-foreground px-2 py-0.5 text-sm font-bold text-background">{g.color ?? t("common.noColor")}</bdi>
                          <span className="text-xs text-muted-foreground">
                            {t("inventory.sizes", { count: g.variants.length })} · {t("sell.inStock", { count: total })}
                          </span>
                        </div>
                        <ul className="pb-1">
                          {g.variants.map((v) => {
                            const label = variantLabel(v.size, v.color) || t("inventory.thisVariation");
                            return (
                            <li key={v.id} className="flex items-center gap-2 py-1 ps-3 pe-1 sm:ps-14">
                              {!showArchived && (
                                <SizePhotoButton
                                  value={v.variation_image_path}
                                  fallback={colorPhoto ?? p.image_path}
                                  label={label}
                                  businessId={v.business_id}
                                  storeId={v.store_id}
                                  onChange={(path) => setVariationPhoto(v, path)}
                                  className="size-9"
                                />
                              )}
                              {/* Tap the size to open this variation's own page. */}
                              <Link href={`/inventory/${v.id}`} aria-label={t("inventory.openVariation", { label: `${p.name} ${label}` })}
                                className="group flex min-w-0 flex-1 items-center gap-1.5 rounded-md py-1 text-sm">
                                <span className="min-w-9 rounded border px-1.5 py-0.5 text-center font-semibold group-hover:bg-muted">{v.size ?? t("inventory.oneSize")}</span>
                                {p.minPrice !== p.maxPrice && <span className="text-xs text-muted-foreground">{formatMoney(v.price_cents)}</span>}
                                <ChevronRight className="size-4 text-muted-foreground rtl:rotate-180" aria-hidden />
                              </Link>
                              {showArchived ? (
                                <span className="w-20 text-end text-sm tabular-nums">{t("common.left", { count: v.quantity })}</span>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => setSettingQty(v)}
                                  aria-label={t("inventory.setQuantityFor", { label })}
                                  className={cn(
                                    "h-9 min-w-20 rounded-md border bg-background px-2 text-sm font-semibold tabular-nums hover:bg-muted",
                                    v.stock_status !== "OK" && "text-orange-700", v.quantity === 0 && "text-red-700",
                                  )}
                                >
                                  {t("common.left", { count: v.quantity })}
                                </button>
                              )}
                              <StockBadge status={v.stock_status} className="w-16 justify-center" />
                              <Button variant="ghost" size="icon-lg" aria-label={t("inventory.actionsFor", { label: `${p.name} ${label}` })} onClick={() => setActing(v)}>
                                <MoreHorizontal />
                              </Button>
                            </li>
                            );
                          })}
                        </ul>
                      </li>
                    );
                  })}
                </ul>

                {!showArchived && !closed && (
                  <div className="flex gap-2 border-t px-3 py-2">
                    <Button variant="outline" size="sm" onClick={() => setAddingTo(p)}><Plus /> {t("inventory.addVariation")}</Button>
                    <Button variant="ghost" size="sm" onClick={() => setEditingProduct(p)}><Pencil /> {t("inventory.editProduct")}</Button>
                  </div>
                )}
                </>)}
              </li>
            );
          })}
        </ul>
      )}
      </>)}

      <SellDialog item={selling?.item ?? null} variants={selling?.variants ?? []} onClose={() => setSelling(null)} />
      <ItemActionsDialog
        item={acting}
        onClose={() => setActing(null)}
        onEdit={(i) => setEditing(i)}
        needsApproval={acting ? needsApproval(acting.store_id) : false}
        isOwner={isOwner}
      />
      <ItemFormDialog
        open={adding || !!editing || !!addingTo}
        onClose={() => { setAdding(false); setEditing(null); setAddingTo(null); }}
        item={editing}
        product={addingTo}
        siblings={editing ? items.filter((i) => i.store_id === editing.store_id && !i.archived
          && i.name.trim().toLowerCase() === editing.name.trim().toLowerCase()) : undefined}
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
      <ProductEditDialog
        product={editingProduct}
        onClose={() => setEditingProduct(null)}
        needsApproval={editingProduct ? needsApproval(editingProduct.store_id) : false}
        categories={categories}
      />
    </div>
  );
}

export function sortByUrgency(items: Item[]) {
  return [...items].sort((a, b) => STOCK_ORDER[a.stock_status] - STOCK_ORDER[b.stock_status]);
}
