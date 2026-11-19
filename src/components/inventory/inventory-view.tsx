"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, MoreHorizontal, Pencil, Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { StockBadge } from "@/components/stock-badge";
import { cn } from "@/lib/utils";
import { formatMoney, STOCK_ORDER } from "@/lib/format";
import { groupProducts, type Product } from "@/lib/products";
import { STOCK_STATUSES, type Item, type Role, type StockStatus } from "@/lib/types";
import { SellDialog } from "./sell-dialog";
import { ItemFormDialog } from "./item-form-dialog";
import { ItemActionsDialog } from "./item-actions-dialog";
import { ItemThumb } from "./item-thumb";
import { ProductEditDialog } from "./product-edit-dialog";

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
  const [status, setStatus] = useState<StockStatus | "ALERTS" | "">(initialStatus ?? "");
  const [storeId, setStoreId] = useState(fixedStoreId ?? "");
  const [showArchived, setShowArchived] = useState(false);
  const [selling, setSelling] = useState<{ item: Item; variants: Item[] } | null>(null);
  const [acting, setActing] = useState<Item | null>(null);
  const [editing, setEditing] = useState<Item | null>(null);
  const [addingTo, setAddingTo] = useState<Product | null>(null);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [adding, setAdding] = useState(false);

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
          onClick={() => setStatus(status === "ALERTS" ? "" : "ALERTS")}
          className="flex items-center gap-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2.5 text-left text-sm text-amber-900"
        >
          <AlertTriangle className="size-5 shrink-0 text-amber-600" />
          <span className="flex-1">
            <b>{alerts} variation{alerts > 1 ? "s" : ""} need restocking</b>
            {" — "}{counts.OUT} out, {counts.CRITICAL} critical, {counts.LOW} low.
          </span>
          <span className="underline shrink-0">{status === "ALERTS" ? "Show all" : "Show"}</span>
        </button>
      )}

      <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto] sm:items-center">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search product, size, color, SKU…" className="pl-9" />
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex">
          {!fixedStoreId && stores.length > 1 && (
            <NativeSelect value={storeId} onChange={(e) => setStoreId(e.target.value)} aria-label="Store" className="sm:w-48">
              <option value="">All stores</option>
              {stores.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </NativeSelect>
          )}
          <NativeSelect value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Category" className="sm:w-40">
            <option value="">All categories</option>
            {categories.map((c) => <option key={c} value={c}>{c}</option>)}
          </NativeSelect>
        </div>
        {editableStores.length > 0 && (
          <Button size="lg" onClick={() => setAdding(true)}><Plus /> Add product</Button>
        )}
      </div>

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
            {s === "" ? `All (${totalProducts})` : `${s[0]}${s.slice(1).toLowerCase()} (${counts[s]})`}
          </button>
        ))}
        {isOwner && (
          <button type="button" onClick={() => setShowArchived((v) => !v)}
            className={cn("shrink-0 rounded-full border px-3 py-1.5 text-sm", showArchived && "bg-muted font-medium")}>
            {showArchived ? "Showing removed" : "Removed items"}
          </button>
        )}
      </div>

      {products.length === 0 ? (
        <div className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">
          {items.length === 0 ? "No products yet. Tap “Add product” to start building this inventory." : "Nothing matches these filters."}
        </div>
      ) : (
        <ul className="grid gap-3">
          {products.map(({ product: p, variants }) => {
            const store = storeById.get(p.store_id);
            const closed = store?.status === "closed";
            const price = p.minPrice === p.maxPrice ? formatMoney(p.minPrice) : `${formatMoney(p.minPrice)}–${formatMoney(p.maxPrice)}`;
            return (
              <li key={p.key} className="overflow-hidden rounded-xl border bg-card">
                <div className="flex items-center gap-3 p-3">
                  <ItemThumb path={p.image_path} alt={p.name} className="size-14" />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="font-semibold">{p.name}</span>
                      {p.status !== "OK" && <StockBadge status={p.status} />}
                    </div>
                    <div className="mt-0.5 text-xs text-muted-foreground">
                      {[p.category, !fixedStoreId && stores.length > 1 ? store?.name : null,
                        `${p.variants.length} variation${p.variants.length === 1 ? "" : "s"}`].filter(Boolean).join(" · ")}
                    </div>
                    <div className="mt-0.5 text-sm">
                      <span className="font-semibold">{price}</span>
                      <span className="ml-2 text-muted-foreground">{p.quantity} in stock</span>
                    </div>
                  </div>
                  {!showArchived && (
                    <Button size="lg" variant="success" className="min-w-20" disabled={p.quantity === 0 || closed} onClick={() => startSale(p)}>
                      Sell
                    </Button>
                  )}
                </div>

                <ul className="divide-y border-t bg-muted/20">
                  {variants.map((v) => (
                    <li key={v.id} className="flex items-center gap-2 py-1.5 pl-3 pr-1">
                      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5 text-sm">
                        {v.size && <span className="rounded bg-background px-1.5 py-0.5 font-semibold ring-1 ring-border">{v.size}</span>}
                        {v.color && <span className="rounded bg-background px-1.5 py-0.5 ring-1 ring-border">{v.color}</span>}
                        {!v.size && !v.color && <span className="text-muted-foreground">Standard</span>}
                        {p.minPrice !== p.maxPrice && <span className="text-xs text-muted-foreground">{formatMoney(v.price_cents)}</span>}
                      </div>
                      <span className={cn("w-16 text-right text-sm tabular-nums", v.stock_status !== "OK" && "font-semibold text-orange-700", v.quantity === 0 && "text-red-700")}>
                        {v.quantity} left
                      </span>
                      <StockBadge status={v.stock_status} className="w-16 justify-center" />
                      <Button variant="ghost" size="icon-lg" aria-label={`Actions for ${p.name} ${v.size ?? ""} ${v.color ?? ""}`} onClick={() => setActing(v)}>
                        <MoreHorizontal />
                      </Button>
                    </li>
                  ))}
                </ul>

                {!showArchived && !closed && (
                  <div className="flex gap-2 border-t px-3 py-2">
                    <Button variant="outline" size="sm" onClick={() => setAddingTo(p)}><Plus /> Add variation</Button>
                    <Button variant="ghost" size="sm" onClick={() => setEditingProduct(p)}><Pencil /> Edit product</Button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

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
        stores={editableStores}
        defaultStoreId={fixedStoreId || storeId || undefined}
        needsApproval={needsApproval}
        categories={categories}
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
