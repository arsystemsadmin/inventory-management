"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, MoreHorizontal, PackagePlus, ShoppingBag } from "lucide-react";
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
import type { InventoryStore } from "@/components/inventory/inventory-view";
import { useActions } from "@/lib/actions-context";
import { formatMoney, variantLabel } from "@/lib/format";
import { sortVariants } from "@/lib/products";
import type { Item, Role, Sale } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useT } from "@/i18n/client";

export type Movement = {
  id: string; delta: number; quantity_after: number;
  reason: "initial" | "restock" | "edit" | "sale" | "void"; actor_id: string | null; created_at: string;
};

/** One variation (a size in a color) on its own page: photo, numbers, history and actions. */
export function VariationDetailView({
  item, siblings, store, sales, movements, peopleNames, role,
}: {
  item: Item;
  /** Every variation of the same product, this one included. */
  siblings: Item[];
  store: InventoryStore | null;
  sales: Sale[];
  movements: Movement[];
  peopleNames: Record<string, string>;
  role: Role;
}) {
  const t = useT();
  const actions = useActions();
  const [selling, setSelling] = useState(false);
  const [settingQty, setSettingQty] = useState(false);
  const [acting, setActing] = useState(false);
  const [editing, setEditing] = useState(false);

  const isOwner = role === "owner";
  const closed = store?.status === "closed";
  const needsApproval = !isOwner && !!store?.inventory_locked_at;
  const label = variantLabel(item.size, item.color) || t("common.standard");
  const productPhoto = siblings.find((v) => v.image_path)?.image_path ?? null;
  const sameColor = (v: Item) => (v.color ?? "").trim().toLowerCase() === (item.color ?? "").trim().toLowerCase();
  const colorPhoto = siblings.find((v) => sameColor(v) && v.variant_image_path)?.variant_image_path ?? null;
  const photo = item.variation_image_path ?? item.variant_image_path ?? productPhoto;
  const active = siblings.filter((v) => !v.archived).sort(sortVariants);

  // Siblings by color, sizes inside: jump straight to another variation.
  const colors = new Map<string, { color: string | null; variants: Item[] }>();
  for (const v of active) {
    const k = (v.color ?? "").trim().toLowerCase();
    const g = colors.get(k);
    if (g) g.variants.push(v); else colors.set(k, { color: v.color, variants: [v] });
  }

  const valid = sales.filter((s) => !s.voided_at);
  const soldUnits = valid.reduce((n, s) => n + s.quantity, 0);
  const soldRevenue = valid.reduce((n, s) => n + s.total_cents, 0);
  const margin = item.price_cents > 0 && item.cost_cents > 0
    ? Math.round(((item.price_cents - item.cost_cents) / item.price_cents) * 100) : null;

  const setPhoto = async (path: string | null) => {
    const res = await actions.saveItemEdit({ itemId: item.id, changes: { variation_image_path: path } });
    if (!res.ok) { toast.error(res.error); return; }
    toast.success(path ? t("inventory.photoSaved", { label }) : t("inventory.photoRemoved", { label }));
  };

  const fact = (name: string, value: React.ReactNode) => (
    <div className="rounded-lg border bg-card p-3">
      <div className="text-xs text-muted-foreground">{name}</div>
      <div className="mt-0.5 font-semibold tabular-nums">{value}</div>
    </div>
  );

  return (
    <div className="mx-auto grid w-full max-w-3xl gap-4">
      <Link href="/inventory" className="inline-flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4 rtl:rotate-180" /> {t("nav.inventory")}
      </Link>

      {/* Header */}
      <div className="flex gap-4">
        <div className="relative shrink-0">
          <ItemThumb path={photo} alt={`${item.name} ${label}`} className="size-28 sm:size-36" />
          {!item.archived && (
            <SizePhotoButton
              value={item.variation_image_path}
              fallback={colorPhoto ?? productPhoto}
              label={label}
              businessId={item.business_id}
              storeId={item.store_id}
              onChange={setPhoto}
              className="absolute -bottom-2 -end-2 size-10 bg-background shadow"
            />
          )}
        </div>
        <div className="grid min-w-0 content-start gap-1.5">
          <h1 className="text-2xl font-semibold"><bdi>{item.name}</bdi></h1>
          <div className="flex flex-wrap items-center gap-2">
            {item.color && <bdi className="rounded-md bg-foreground px-2 py-0.5 text-sm font-bold text-background">{item.color}</bdi>}
            {item.size && <span className="rounded-md border px-2 py-0.5 text-sm font-semibold">{item.size}</span>}
            <StockBadge status={item.stock_status} />
            {item.archived && <span className="rounded-md bg-muted px-2 py-0.5 text-xs font-medium">{t("variation.removed")}</span>}
          </div>
          <div className="text-xl font-semibold tabular-nums">{formatMoney(item.price_cents)}</div>
          <div className="text-sm text-muted-foreground">
            {[store?.name, item.category].filter(Boolean).join(" · ")}
          </div>
        </div>
      </div>

      {/* Actions */}
      {!item.archived && (
        <div className="grid grid-cols-3 gap-2">
          <Button size="lg" variant="success" disabled={item.quantity === 0 || closed} onClick={() => setSelling(true)}>
            <ShoppingBag /> {t("inventory.sell")}
          </Button>
          <Button size="lg" variant="outline" disabled={closed} onClick={() => setSettingQty(true)}>
            <PackagePlus /> {t("variation.stock")}
          </Button>
          <Button size="lg" variant="outline" onClick={() => setActing(true)}>
            <MoreHorizontal /> {t("variation.more")}
          </Button>
        </div>
      )}
      {item.archived && isOwner && (
        <Button size="lg" variant="outline" onClick={() => setActing(true)}>{t("actions.restoreVariation")}</Button>
      )}

      {/* Numbers */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {fact(t("variation.inStock"), <span className={cn(item.quantity === 0 && "text-red-700")}>{item.quantity}</span>)}
        {fact(t("variation.alertAt"), item.low_stock_threshold)}
        {fact(t("form.costLabel"), item.cost_cents ? formatMoney(item.cost_cents) : "—")}
        {fact(t("variation.margin"), margin === null ? "—" : `${margin}%`)}
        {fact(t("variation.unitsSold"), soldUnits)}
        {fact(t("variation.revenue"), formatMoney(soldRevenue))}
        {fact(t("fields.sku"), item.sku || "—")}
        {fact(t("variation.lastSold"), valid[0] ? <LocalTime iso={valid[0].created_at} mode="date" /> : "—")}
      </div>

      {/* Other variations */}
      {active.length > 1 && (
        <Card>
          <CardHeader><CardTitle className="text-base">{t("variation.otherVariations")}</CardTitle></CardHeader>
          <CardContent className="grid gap-3">
            {[...colors.values()].sort((a, b) => (a.color ?? "").localeCompare(b.color ?? "")).map((g) => (
              <div key={g.color ?? "none"} className="flex flex-wrap items-center gap-2">
                <bdi className="min-w-16 text-sm font-medium">{g.color ?? t("common.noColor")}</bdi>
                {g.variants.map((v) => (
                  <Link
                    key={v.id}
                    href={`/inventory/${v.id}`}
                    aria-current={v.id === item.id ? "page" : undefined}
                    className={cn(
                      "min-w-11 rounded-lg border px-2.5 py-1.5 text-center text-sm font-semibold",
                      v.id === item.id ? "border-foreground bg-foreground text-background" : "bg-background hover:bg-muted",
                      v.quantity === 0 && v.id !== item.id && "text-red-700 line-through",
                    )}
                  >
                    {v.size ?? t("inventory.oneSize")}
                    <span className="ms-1 text-xs font-normal opacity-70">{v.quantity}</span>
                  </Link>
                ))}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Sales */}
      <Card>
        <CardHeader><CardTitle className="text-base">{t("variation.salesHistory")}</CardTitle></CardHeader>
        <CardContent>
          {sales.length === 0 ? <p className="text-sm text-muted-foreground">{t("variation.noSales")}</p> : (
            <ul className="divide-y">
              {sales.map((s) => (
                <li key={s.id} className="flex items-center gap-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <div className={cn("text-sm font-medium", s.voided_at && "line-through text-muted-foreground")}>
                      {s.quantity} × {formatMoney(s.unit_price_cents)}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      <LocalTime iso={s.created_at} /> · {peopleNames[s.sold_by] ?? "—"}
                      {s.voided_at && <span className="ms-1 font-medium text-red-700">· {t("sales.voided")}</span>}
                    </div>
                  </div>
                  <PaymentBadge method={s.payment_method} cashCents={s.cash_cents} creditCents={s.credit_cents} />
                  <div className="w-20 text-end font-semibold tabular-nums">{formatMoney(s.total_cents)}</div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Stock history */}
      <Card>
        <CardHeader><CardTitle className="text-base">{t("variation.stockHistory")}</CardTitle></CardHeader>
        <CardContent>
          {movements.length === 0 ? <p className="text-sm text-muted-foreground">{t("variation.noMovements")}</p> : (
            <ul className="divide-y">
              {movements.map((m) => (
                <li key={m.id} className="flex items-center gap-3 py-2.5 text-sm">
                  <span className={cn("w-12 font-semibold tabular-nums", m.delta > 0 ? "text-emerald-700" : "text-red-700")} dir="ltr">
                    {m.delta > 0 ? `+${m.delta}` : m.delta}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="font-medium">{t(`variation.reason_${m.reason}`)}</div>
                    <div className="text-xs text-muted-foreground">
                      <LocalTime iso={m.created_at} />{m.actor_id && ` · ${peopleNames[m.actor_id] ?? "—"}`}
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground">{t("common.left", { count: m.quantity_after })}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <SellDialog item={selling ? item : null} variants={active} onClose={() => setSelling(false)} />
      <QuantityDialog item={settingQty ? item : null} onClose={() => setSettingQty(false)} needsApproval={needsApproval} />
      <ItemActionsDialog
        item={acting ? item : null}
        onClose={() => setActing(false)}
        onEdit={() => setEditing(true)}
        needsApproval={needsApproval}
        isOwner={isOwner}
      />
      <ItemFormDialog
        open={editing}
        onClose={() => setEditing(false)}
        item={editing ? item : null}
        siblings={siblings}
        stores={store ? [store] : []}
        needsApproval={() => needsApproval}
        categories={[]}
      />
    </div>
  );
}
