"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, ChevronRight, MoreHorizontal, Pencil, Plus, ShoppingBag, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LocalTime } from "@/components/local-time";
import { StockBadge } from "@/components/stock-badge";
import { PaymentBadge } from "@/components/sales/payment-badge";
import { ItemThumb } from "@/components/inventory/item-thumb";
import { SizePhotoButton } from "@/components/inventory/photo-field";
import { SellDialog } from "@/components/inventory/sell-dialog";
import { QuantityDialog } from "@/components/inventory/quantity-dialog";
import { ItemActionsDialog } from "@/components/inventory/item-actions-dialog";
import { ItemFormDialog } from "@/components/inventory/item-form-dialog";
import { ProductEditDialog } from "@/components/inventory/product-edit-dialog";
import type { InventoryStore } from "@/components/inventory/inventory-view";
import { useActions } from "@/lib/actions-context";
import { formatMoney, STOCK_ORDER, variantLabel } from "@/lib/format";
import { groupProducts, sortVariants, usualPrice } from "@/lib/products";
import { colorHref, colorKey, productHref } from "@/lib/product-links";
import type { Item, Movement, Role, Sale, StockStatus } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useT } from "@/i18n/client";

export type DetailProps = {
  /** The variation the address points at. */
  anchor: Item;
  /** Every variation of the product, removed ones included. */
  siblings: Item[];
  store: InventoryStore | null;
  sales: Sale[];
  movements: Movement[];
  peopleNames: Record<string, string>;
  role: Role;
};

type ColorGroup = { key: string; color: string | null; variants: Item[]; quantity: number; status: StockStatus; outCount: number; photo: string | null };

/** Colors (A→Z), each with its sizes in size order. Status: OUT only when every size is out. */
function colorGroups(variants: Item[]): ColorGroup[] {
  const map = new Map<string, Item[]>();
  for (const v of [...variants].sort(sortVariants)) {
    const k = colorKey(v.color);
    const list = map.get(k);
    if (list) list.push(v); else map.set(k, [v]);
  }
  return [...map.entries()].map(([key, vs]) => {
    const inStock = vs.filter((v) => v.quantity > 0);
    return {
      key, color: vs[0].color, variants: vs,
      quantity: vs.reduce((n, v) => n + v.quantity, 0),
      status: inStock.length === 0 ? "OUT" as const
        : inStock.reduce<StockStatus>((w, v) => (STOCK_ORDER[v.stock_status] < STOCK_ORDER[w] ? v.stock_status : w), "OK"),
      outCount: vs.length - inStock.length,
      photo: vs.find((v) => v.variant_image_path)?.variant_image_path ?? null,
    };
  }).sort((a, b) => (a.color ?? "").localeCompare(b.color ?? ""));
}

const priceRange = (vs: Item[]) => {
  const ps = vs.map((v) => v.price_cents);
  if (!ps.length) return formatMoney(0);
  const lo = Math.min(...ps), hi = Math.max(...ps);
  return lo === hi ? formatMoney(lo) : `${formatMoney(lo)}–${formatMoney(hi)}`;
};

function Fact({ name, children }: { name: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border bg-card p-3">
      <div className="text-xs text-muted-foreground">{name}</div>
      <div className="mt-0.5 font-semibold tabular-nums">{children}</div>
    </div>
  );
}

function SalesCard({ sales, peopleNames, showVariant }: { sales: Sale[]; peopleNames: Record<string, string>; showVariant: "color+size" | "size" }) {
  const t = useT();
  const [limit, setLimit] = useState(20);
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">{t("variation.salesHistory")}</CardTitle></CardHeader>
      <CardContent>
        {sales.length === 0 ? <p className="text-sm text-muted-foreground">{t("variation.noSales")}</p> : (
          <>
            <ul className="divide-y">
              {sales.slice(0, limit).map((s) => {
                const v = showVariant === "size" ? (s.size ?? "") : variantLabel(s.size, s.color);
                return (
                  <li key={s.id} className="flex items-center gap-3 py-2.5">
                    <div className="min-w-0 flex-1">
                      <div className={cn("text-sm font-medium", s.voided_at && "line-through text-muted-foreground")}>
                        {s.quantity} × {formatMoney(s.unit_price_cents)}{v && <span className="text-muted-foreground"> · <bdi>{v}</bdi></span>}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        <LocalTime iso={s.created_at} /> · {peopleNames[s.sold_by] ?? "—"}
                        {s.voided_at && <span className="ms-1 font-medium text-red-700">· {t("sales.voided")}</span>}
                      </div>
                    </div>
                    <PaymentBadge method={s.payment_method} cashCents={s.cash_cents} creditCents={s.credit_cents} otherName={s.payment_other} />
                    <div className="w-20 text-end font-semibold tabular-nums">{formatMoney(s.total_cents)}</div>
                  </li>
                );
              })}
            </ul>
            {sales.length > limit && <Button variant="ghost" className="w-full" onClick={() => setLimit((n) => n + 20)}>{t("sales.showMore")}</Button>}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function MovementsCard({ movements, items, peopleNames }: { movements: Movement[]; items: Item[]; peopleNames: Record<string, string> }) {
  const t = useT();
  const [limit, setLimit] = useState(20);
  const byId = new Map(items.map((i) => [i.id, i]));
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">{t("variation.stockHistory")}</CardTitle></CardHeader>
      <CardContent>
        {movements.length === 0 ? <p className="text-sm text-muted-foreground">{t("variation.noMovements")}</p> : (
          <>
            <ul className="divide-y">
              {movements.slice(0, limit).map((m) => (
                <li key={m.id} className="flex items-center gap-3 py-2.5 text-sm">
                  <span className={cn("w-12 font-semibold tabular-nums", m.delta > 0 ? "text-emerald-700" : "text-red-700")} dir="ltr">
                    {m.delta > 0 ? `+${m.delta}` : m.delta}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="font-medium">
                      {t(`variation.reason_${m.reason}`)}
                      {byId.get(m.item_id)?.size && <span className="text-muted-foreground"> · {byId.get(m.item_id)!.size}</span>}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      <LocalTime iso={m.created_at} />{m.actor_id && ` · ${peopleNames[m.actor_id] ?? "—"}`}
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground">{t("common.left", { count: m.quantity_after })}</span>
                </li>
              ))}
            </ul>
            {movements.length > limit && <Button variant="ghost" className="w-full" onClick={() => setLimit((n) => n + 20)}>{t("sales.showMore")}</Button>}
          </>
        )}
      </CardContent>
    </Card>
  );
}

/** Compact size chips: "S 3 · M 0 · L 2" with sold-out sizes struck through in red. */
function SizeChips({ variants }: { variants: Item[] }) {
  const t = useT();
  return (
    <div className="flex flex-wrap gap-1">
      {variants.map((v) => (
        <span key={v.id} className={cn(
          "rounded px-1.5 py-0.5 text-[11px] font-semibold tabular-nums ring-1 ring-border",
          v.quantity === 0 ? "bg-red-50 text-red-700 line-through" : v.stock_status !== "OK" ? "bg-amber-50 text-amber-800" : "bg-background",
        )}>
          {v.size ?? t("inventory.oneSize")} {v.quantity}
        </span>
      ))}
    </div>
  );
}

function useSaleTotals(sales: Sale[]) {
  const valid = sales.filter((s) => !s.voided_at);
  return {
    units: valid.reduce((n, s) => n + s.quantity, 0),
    revenue: valid.reduce((n, s) => n + s.total_cents, 0),
    last: valid[0]?.created_at ?? null,
  };
}

// ------------------------------------------------------------- product ---

/** A product with every color listed; tap a color for its sizes. */
export function ProductDetailView({ anchor, siblings, store, sales, movements, peopleNames, role }: DetailProps) {
  const t = useT();
  const actions = useActions();
  const [selling, setSelling] = useState(false);
  const [adding, setAdding] = useState(false);
  const [editingProduct, setEditingProduct] = useState(false);
  const [restoring, setRestoring] = useState<string | null>(null);

  const isOwner = role === "owner";
  const closed = store?.status === "closed";
  const needsApproval = !isOwner && !!store?.inventory_locked_at;
  const active = siblings.filter((v) => !v.archived);
  const removed = siblings.filter((v) => v.archived);
  const product = groupProducts(active.length ? active : [anchor])[0];
  const groups = colorGroups(active);
  const totals = useSaleTotals(sales);
  const sellFrom = [...active].sort((a, b) => Number(b.quantity > 0) - Number(a.quantity > 0))[0];

  const restore = async (id: string) => {
    setRestoring(id);
    const res = await actions.restoreItem(id);
    setRestoring(null);
    if (res.ok) toast.success(res.message); else toast.error(res.error);
  };

  return (
    <div className="mx-auto grid w-full max-w-3xl gap-4">
      <Link href="/inventory" className="inline-flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4 rtl:rotate-180" /> {t("nav.inventory")}
      </Link>

      <div className="flex items-start gap-4">
        <ItemThumb path={product.image_path} alt={product.name} className="size-24 shrink-0 sm:size-32" />
        <div className="grid min-w-0 gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold"><bdi>{product.name}</bdi></h1>
            {active.length > 0 && <StockBadge status={product.status} />}
          </div>
          <div className="text-lg font-semibold tabular-nums">{priceRange(active)}</div>
          <div className="text-sm text-muted-foreground">
            {[t("sell.inStock", { count: product.quantity }), store?.name, product.category].filter(Boolean).join(" · ")}
          </div>
          {product.outCount > 0 && active.length > 0 && (
            <div className="text-sm font-medium text-red-700">{t("inventory.soldOutCount", { count: product.outCount })}</div>
          )}
        </div>
      </div>

      {active.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          <Button size="lg" variant="success" disabled={product.quantity === 0 || closed} onClick={() => setSelling(true)}>
            <ShoppingBag /> {t("inventory.sell")}
          </Button>
          <Button size="lg" variant="outline" disabled={closed} onClick={() => setAdding(true)}>
            <Plus /> {t("product.addColor")}
          </Button>
          <Button size="lg" variant="outline" disabled={closed} onClick={() => setEditingProduct(true)}>
            <Pencil /> {t("product.edit")}
          </Button>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Fact name={t("product.colors")}>{groups.length}</Fact>
        <Fact name={t("product.variations")}>{active.length}</Fact>
        <Fact name={t("variation.unitsSold")}>{totals.units}</Fact>
        <Fact name={t("variation.revenue")}>{formatMoney(totals.revenue)}</Fact>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">{t("product.colorsAndSizes")}</CardTitle></CardHeader>
        <CardContent className="px-0 pb-1">
          {groups.length === 0 ? <p className="px-6 pb-4 text-sm text-muted-foreground">{t("product.noActive")}</p> : (
            <ul className="divide-y border-t">
              {groups.map((g) => (
                <li key={g.key}>
                  <Link href={colorHref(g.variants[0].id)} className="flex items-start gap-3 px-4 py-3 hover:bg-muted/50">
                    <ItemThumb path={g.photo ?? g.variants.find((v) => v.variation_image_path)?.variation_image_path ?? product.image_path}
                      alt={`${product.name} ${g.color ?? ""}`} className="size-12 shrink-0" />
                    <div className="grid min-w-0 flex-1 gap-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <bdi className="font-semibold">{g.color ?? t("common.noColor")}</bdi>
                        {g.status !== "OK" && <StockBadge status={g.status} />}
                        <span className="text-xs text-muted-foreground">{t("sell.inStock", { count: g.quantity })}</span>
                      </div>
                      <SizeChips variants={g.variants} />
                    </div>
                    <ChevronRight className="mt-3 size-5 shrink-0 text-muted-foreground rtl:rotate-180" aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {removed.length > 0 && (isOwner || removed.length > 0) && (
        <Card>
          <CardHeader><CardTitle className="text-base">{t("product.removed")}</CardTitle></CardHeader>
          <CardContent>
            <ul className="divide-y">
              {removed.sort(sortVariants).map((v) => (
                <li key={v.id} className="flex items-center gap-3 py-2 text-sm">
                  <bdi className="flex-1">{variantLabel(v.size, v.color) || t("common.standard")}</bdi>
                  {isOwner && (
                    <Button size="sm" variant="outline" disabled={restoring === v.id} onClick={() => restore(v.id)}>
                      <Undo2 /> {t("actions.restoreVariation")}
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <SalesCard sales={sales} peopleNames={peopleNames} showVariant="color+size" />
      <MovementsCard movements={movements} items={siblings} peopleNames={peopleNames} />

      <SellDialog item={selling ? sellFrom ?? null : null} variants={active} onClose={() => setSelling(false)} />
      <ItemFormDialog
        open={adding}
        onClose={() => setAdding(false)}
        product={adding ? product : null}
        stores={store ? [store] : []}
        needsApproval={() => needsApproval}
        categories={[]}
      />
      <ProductEditDialog
        product={editingProduct ? product : null}
        onClose={() => setEditingProduct(false)}
        needsApproval={needsApproval}
        categories={[]}
      />
    </div>
  );
}

// --------------------------------------------------------------- color ---

/** One color of a product: all its sizes with stock, photos and actions. */
export function ColorDetailView({ anchor, siblings, store, sales, movements, peopleNames, role }: DetailProps) {
  const t = useT();
  const actions = useActions();
  const [selling, setSelling] = useState(false);
  const [settingQty, setSettingQty] = useState<Item | null>(null);
  const [acting, setActing] = useState<Item | null>(null);
  const [editing, setEditing] = useState<Item | null>(null);
  const [adding, setAdding] = useState(false);

  const isOwner = role === "owner";
  const closed = store?.status === "closed";
  const needsApproval = !isOwner && !!store?.inventory_locked_at;
  const key = colorKey(anchor.color);
  const active = siblings.filter((v) => !v.archived);
  const product = groupProducts(active.length ? active : [anchor])[0];
  const groups = colorGroups(active);
  const group = groups.find((g) => g.key === key);
  const sizes = group?.variants ?? [];
  const ids = new Set(siblings.filter((v) => colorKey(v.color) === key).map((v) => v.id));
  const colorSales = sales.filter((s) => ids.has(s.item_id));
  const colorMoves = movements.filter((m) => ids.has(m.item_id));
  const totals = useSaleTotals(colorSales);
  const colorName = anchor.color ?? t("common.noColor");
  const productPhoto = product.image_path;
  const cost = usualPrice(sizes, "cost_cents");
  const price = usualPrice(sizes);
  const margin = price > 0 && cost > 0 ? Math.round(((price - cost) / price) * 100) : null;
  const sellFrom = [...sizes].sort((a, b) => Number(b.quantity > 0) - Number(a.quantity > 0))[0];
  const productLink = productHref((active[0] ?? anchor).id);

  // The color photo is shared by every size of this color.
  const setColorPhoto = async (path: string | null) => {
    for (const v of sizes) {
      const res = await actions.saveItemEdit({ itemId: v.id, changes: { variant_image_path: path } });
      if (!res.ok) { toast.error(res.error); return; }
    }
    toast.success(path ? t("inventory.photoSaved", { label: colorName }) : t("inventory.photoRemoved", { label: colorName }));
  };
  const setSizePhoto = async (v: Item, path: string | null) => {
    const res = await actions.saveItemEdit({ itemId: v.id, changes: { variation_image_path: path } });
    const label = variantLabel(v.size, v.color) || t("inventory.thisVariation");
    if (!res.ok) { toast.error(res.error); return; }
    toast.success(path ? t("inventory.photoSaved", { label }) : t("inventory.photoRemoved", { label }));
  };

  return (
    <div className="mx-auto grid w-full max-w-3xl gap-4">
      <Link href={productLink} className="inline-flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4 rtl:rotate-180" /> <bdi>{product.name}</bdi>
      </Link>

      <div className="flex items-start gap-4">
        <div className="grid shrink-0 justify-items-center gap-1.5">
          <ItemThumb path={group?.photo ?? productPhoto} alt={`${product.name} ${colorName}`} className="size-24 sm:size-32" />
          {group && (
            <SizePhotoButton value={group.photo} fallback={productPhoto} label={colorName}
              businessId={anchor.business_id} storeId={anchor.store_id} onChange={setColorPhoto}
              className="size-9" />
          )}
        </div>
        <div className="grid min-w-0 gap-1">
          <h1 className="text-2xl font-semibold"><bdi>{product.name}</bdi></h1>
          <div className="flex flex-wrap items-center gap-2">
            <bdi className="rounded-md bg-foreground px-2 py-0.5 text-sm font-bold text-background">{colorName}</bdi>
            {group && <StockBadge status={group.status} />}
          </div>
          <div className="text-lg font-semibold tabular-nums">{priceRange(sizes)}</div>
          <div className="text-sm text-muted-foreground">
            {t("sell.inStock", { count: group?.quantity ?? 0 })} · {t("inventory.sizes", { count: sizes.length })}
          </div>
        </div>
      </div>

      {group ? (
        <div className="grid grid-cols-2 gap-2">
          <Button size="lg" variant="success" disabled={group.quantity === 0 || closed} onClick={() => setSelling(true)}>
            <ShoppingBag /> {t("inventory.sell")}
          </Button>
          <Button size="lg" variant="outline" disabled={closed} onClick={() => setAdding(true)}>
            <Plus /> {t("product.addSizes")}
          </Button>
        </div>
      ) : (
        <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">{t("product.colorRemoved")}</p>
      )}

      {/* Other colors: one scrollable line */}
      {groups.length > 1 && (
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
          {groups.map((g) => (
            <Link key={g.key} href={colorHref(g.variants[0].id)} aria-current={g.key === key ? "page" : undefined}
              className={cn(
                "shrink-0 rounded-full border px-3 py-1.5 text-sm font-medium",
                g.key === key ? "border-foreground bg-foreground text-background" : "bg-background hover:bg-muted",
                g.status === "OUT" && g.key !== key && "text-red-700 line-through",
              )}>
              <bdi>{g.color ?? t("common.noColor")}</bdi>
            </Link>
          ))}
        </div>
      )}

      {sizes.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">{t("product.sizes")}</CardTitle></CardHeader>
          <CardContent className="px-0 pb-1">
            <ul className="divide-y border-t">
              {sizes.map((v) => {
                const label = variantLabel(v.size, v.color) || t("inventory.thisVariation");
                return (
                  <li key={v.id} className="flex items-center gap-2 px-4 py-2">
                    <SizePhotoButton value={v.variation_image_path} fallback={group?.photo ?? productPhoto} label={label}
                      businessId={v.business_id} storeId={v.store_id} onChange={(path) => setSizePhoto(v, path)} className="size-10" />
                    <div className="min-w-0 flex-1">
                      <span className="inline-block min-w-9 rounded border px-1.5 py-0.5 text-center text-sm font-bold">{v.size ?? t("inventory.oneSize")}</span>
                      {(v.price_cents !== price || v.sku) && (
                        <div className="mt-0.5 truncate text-xs text-muted-foreground">
                          {[v.price_cents !== price ? formatMoney(v.price_cents) : null, v.sku].filter(Boolean).join(" · ")}
                        </div>
                      )}
                    </div>
                    <button type="button" onClick={() => setSettingQty(v)} disabled={closed}
                      aria-label={t("inventory.setQuantityFor", { label })}
                      className={cn("h-10 min-w-20 rounded-md border bg-background px-2 text-sm font-semibold tabular-nums hover:bg-muted",
                        v.stock_status !== "OK" && "text-orange-700", v.quantity === 0 && "text-red-700")}>
                      {t("common.left", { count: v.quantity })}
                    </button>
                    <StockBadge status={v.stock_status} className="w-16 justify-center" />
                    <Button variant="ghost" size="icon-lg" aria-label={t("inventory.actionsFor", { label: `${product.name} ${label}` })} onClick={() => setActing(v)}>
                      <MoreHorizontal />
                    </Button>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Fact name={t("variation.unitsSold")}>{totals.units}</Fact>
        <Fact name={t("variation.revenue")}>{formatMoney(totals.revenue)}</Fact>
        <Fact name={t("variation.margin")}>{margin === null ? "—" : `${margin}%`}</Fact>
        <Fact name={t("variation.lastSold")}>{totals.last ? <LocalTime iso={totals.last} mode="date" /> : "—"}</Fact>
      </div>

      <SalesCard sales={colorSales} peopleNames={peopleNames} showVariant="size" />
      <MovementsCard movements={colorMoves} items={siblings} peopleNames={peopleNames} />

      <SellDialog item={selling ? sellFrom ?? null : null} variants={active} onClose={() => setSelling(false)} />
      <QuantityDialog item={settingQty} onClose={() => setSettingQty(null)} needsApproval={needsApproval} />
      <ItemActionsDialog item={acting} onClose={() => setActing(null)} onEdit={(i) => setEditing(i)} needsApproval={needsApproval} isOwner={isOwner} />
      <ItemFormDialog
        open={!!editing || adding}
        onClose={() => { setEditing(null); setAdding(false); }}
        item={editing}
        product={adding ? product : null}
        presetColor={adding ? anchor.color ?? "" : undefined}
        siblings={siblings}
        stores={store ? [store] : []}
        needsApproval={() => needsApproval}
        categories={[]}
      />
    </div>
  );
}
