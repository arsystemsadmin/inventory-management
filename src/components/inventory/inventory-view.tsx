"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, MoreHorizontal, Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { StockBadge } from "@/components/stock-badge";
import { cn } from "@/lib/utils";
import { formatMoney, STOCK_ORDER } from "@/lib/format";
import { STOCK_STATUSES, type Item, type Role, type StockStatus } from "@/lib/types";
import { SellDialog } from "./sell-dialog";
import { ItemFormDialog } from "./item-form-dialog";
import { ItemActionsDialog } from "./item-actions-dialog";

export type InventoryStore = { id: string; name: string; inventory_locked_at: string | null; status: string };

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
  const [selling, setSelling] = useState<Item | null>(null);
  const [acting, setActing] = useState<Item | null>(null);
  const [editing, setEditing] = useState<Item | null>(null);
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
  const counts = useMemo(() => {
    const c: Record<StockStatus, number> = { OUT: 0, CRITICAL: 0, LOW: 0, OK: 0 };
    scoped.forEach((i) => c[i.stock_status]++);
    return c;
  }, [scoped]);
  const alerts = counts.OUT + counts.CRITICAL + counts.LOW;

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return scoped
      .filter((i) => !category || i.category === category)
      .filter((i) => !status || (status === "ALERTS" ? i.stock_status !== "OK" : i.stock_status === status))
      .filter((i) =>
        !needle ||
        [i.name, i.sku, i.size, i.color, i.category].some((v) => v?.toLowerCase().includes(needle)),
      )
      .sort((a, b) =>
        a.name.localeCompare(b.name) || (a.size ?? "").localeCompare(b.size ?? "", undefined, { numeric: true }) ||
        (a.color ?? "").localeCompare(b.color ?? ""),
      );
  }, [scoped, q, category, status]);

  const variantsOf = (item: Item) =>
    items.filter((i) => i.store_id === item.store_id && i.name === item.name && !i.archived);

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
            <b>{alerts} item{alerts > 1 ? "s" : ""} need restocking</b>
            {" — "}{counts.OUT} out, {counts.CRITICAL} critical, {counts.LOW} low.
          </span>
          <span className="underline shrink-0">{status === "ALERTS" ? "Show all" : "Show"}</span>
        </button>
      )}

      <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto] sm:items-center">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, size, color, SKU…" className="pl-9" />
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
          <Button size="lg" onClick={() => setAdding(true)}><Plus /> Add item</Button>
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
            {s === "" ? `All (${scoped.length})` : `${s[0]}${s.slice(1).toLowerCase()} (${counts[s]})`}
          </button>
        ))}
        {isOwner && (
          <button type="button" onClick={() => setShowArchived((v) => !v)}
            className={cn("shrink-0 rounded-full border px-3 py-1.5 text-sm", showArchived && "bg-muted font-medium")}>
            {showArchived ? "Showing removed" : "Removed items"}
          </button>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">
          {items.length === 0 ? "No items yet. Tap “Add item” to start building this inventory." : "No items match these filters."}
        </div>
      ) : (
        <ul className="divide-y rounded-lg border bg-card">
          {filtered.map((item) => (
            <li key={item.id} className="flex items-center gap-3 px-3 py-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="font-medium">{item.name}</span>
                  <StockBadge status={item.stock_status} />
                </div>
                <div className="mt-1 flex flex-wrap gap-1.5 text-xs">
                  {item.size && <span className="rounded bg-muted px-1.5 py-0.5 font-medium">{item.size}</span>}
                  {item.color && <span className="rounded bg-muted px-1.5 py-0.5 font-medium">{item.color}</span>}
                  {item.category && <span className="text-muted-foreground">{item.category}</span>}
                  {!fixedStoreId && stores.length > 1 && (
                    <span className="text-muted-foreground">· {storeById.get(item.store_id)?.name}</span>
                  )}
                </div>
                <div className="mt-1 text-sm">
                  <span className="font-semibold">{formatMoney(item.price_cents)}</span>
                  <span className={cn("ml-2", item.stock_status !== "OK" && "font-semibold text-orange-700", item.quantity === 0 && "text-red-700")}>
                    {item.quantity} in stock
                  </span>
                </div>
              </div>
              {!item.archived && (
                <Button
                  size="lg"
                  variant="success"
                  className="min-w-20"
                  disabled={item.quantity === 0 || storeById.get(item.store_id)?.status === "closed"}
                  onClick={() => setSelling(item)}
                >
                  Sell
                </Button>
              )}
              <Button variant="ghost" size="icon-lg" aria-label={`More actions for ${item.name}`} onClick={() => setActing(item)}>
                <MoreHorizontal />
              </Button>
            </li>
          ))}
        </ul>
      )}

      <SellDialog item={selling} variants={selling ? variantsOf(selling) : []} onClose={() => setSelling(null)} />
      <ItemActionsDialog
        item={acting}
        onClose={() => setActing(null)}
        onEdit={(i) => setEditing(i)}
        needsApproval={acting ? needsApproval(acting.store_id) : false}
        isOwner={isOwner}
      />
      <ItemFormDialog
        open={adding || !!editing}
        onClose={() => { setAdding(false); setEditing(null); }}
        item={editing}
        stores={editableStores}
        defaultStoreId={fixedStoreId || storeId || undefined}
        needsApproval={needsApproval}
        categories={categories}
      />
    </div>
  );
}

export function sortByUrgency(items: Item[]) {
  return [...items].sort((a, b) => STOCK_ORDER[a.stock_status] - STOCK_ORDER[b.stock_status]);
}
