"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { Minus, Plus, ShoppingCart } from "lucide-react";
import { toast } from "sonner";
import { useActions } from "@/lib/actions-context";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { StockBadge } from "@/components/stock-badge";
import { PaymentPicker, usePayment } from "@/components/sales/payment-picker";
import { addToCart, openCart } from "@/lib/cart";
import { ItemThumb } from "./item-thumb";
import { cn } from "@/lib/utils";
import { formatMoney, isolate, STOCK_ORDER, variantLabel } from "@/lib/format";
import type { Item, PaymentMethod, SellResult } from "@/lib/types";
import { useT } from "@/i18n/client";

/**
 * Fast sale confirmation: pick the variant (size/color), the quantity, confirm.
 * `variants` = all active rows with the same product name in the same store.
 */
/** Success toast for one sold line, plus a warning if it just ran low or out. */
export function announceSale(r: SellResult, method: PaymentMethod, t: ReturnType<typeof useT>, quiet = false) {
  const v = variantLabel(r.size, r.color);
  const name = `${isolate(r.item_name)}${v ? ` (${v})` : ""}`;
  if (!quiet) {
    toast.success(t("sell.sold", { label: `${r.quantity_sold} × ${name}` }), {
      description: `${formatMoney(r.total_cents)} · ${t(`payment.${method}`)} · ${t("common.left", { count: r.quantity_after })}`,
    });
  }
  if (r.status_after !== "OK" && STOCK_ORDER[r.status_after] < STOCK_ORDER[r.status_before]) {
    const msg = r.status_after === "OUT" ? t("sell.nowOut", { name }) : r.status_after === "CRITICAL" ? t("sell.nowCritical", { name }) : t("sell.nowLow", { name });
    toast.warning(msg, {
      description: r.status_after === "OUT" ? t("sell.askOwner") : t("common.left", { count: r.quantity_after }),
      duration: 8000,
    });
  }
}

export function SellDialog({
  item, variants, onClose, mode = "sell",
}: {
  item: Item | null;
  variants: Item[];
  onClose: () => void;
  /** "cart": only pick the variation and quantity, then add it to the quick-sale cart. */
  mode?: "sell" | "cart";
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [qty, setQty] = useState(1);
  const [pending, startTransition] = useTransition();
  const actions = useActions();
  const t = useT();
  const selectedPrice = variants.find((v) => v.id === selectedId)?.price_cents ?? item?.price_cents ?? 0;
  const pay = usePayment(qty * selectedPrice);

  useEffect(() => {
    if (item) { setSelectedId(item.id); setQty(1); pay.reset(); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item?.id]);

  const selected = useMemo(
    () => variants.find((v) => v.id === selectedId) ?? item,
    [variants, selectedId, item],
  );
  if (!item || !selected) return null;

  const max = selected.quantity;
  const sizes = Array.from(new Set(variants.map((v) => v.size ?? "")));
  const colors = Array.from(new Set(variants.map((v) => v.color ?? "")));
  const pick = (size: string, color: string) => {
    const match = variants.find((v) => (v.size ?? "") === size && (v.color ?? "") === color)
      // Color comes first: keep the color, then try the size.
      ?? [...variants].sort((x, y) => Number(y.quantity > 0) - Number(x.quantity > 0)).find((v) => (v.color ?? "") === color)
      ?? variants.find((v) => (v.size ?? "") === size);
    if (match) { setSelectedId(match.id); setQty(1); }
  };

  const confirm = () => {
    if (!pay.valid) return;
    const method = pay.method;
    startTransition(async () => {
      const res = await actions.sellItem({ itemId: selected.id, quantity: qty, payment: pay.input() });
      if (!res.ok) { toast.error(res.error); return; }
      announceSale(res.data!, method, t);
      onClose();
    });
  };

  const addLine = () => {
    const inCart = addToCart(selected, qty);
    const v = variantLabel(selected.size, selected.color);
    toast.success(t("cart.added", { label: `${qty} × ${isolate(selected.name)}${v ? ` (${v})` : ""}` }), {
      description: t("cart.inCartNow", { count: inCart }),
      ...(mode === "sell" ? { action: { label: t("cart.view"), onClick: () => openCart() } } : {}),
    });
    onClose();
  };

  const chip = (active: boolean, disabled: boolean) =>
    cn(
      "min-h-11 min-w-11 rounded-lg border px-3 text-sm font-medium transition-colors",
      active ? "border-foreground bg-foreground text-background" : "bg-background hover:bg-muted",
      disabled && "opacity-40 line-through",
    );

  return (
    <Dialog open={!!item} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader className="flex-row items-center gap-3">
          <ItemThumb path={selected.variation_image_path ?? selected.variant_image_path ?? selected.image_path ?? variants.find((v) => v.image_path)?.image_path}
            alt={selected.name} className="size-16" />
          <div className="grid gap-1.5">
            <DialogTitle>{t("sell.title", { name: isolate(selected.name) })}</DialogTitle>
            <DialogDescription>{t("sales.each", { price: formatMoney(selected.price_cents) })}</DialogDescription>
          </div>
        </DialogHeader>

        {colors.some(Boolean) && (
          <div className="grid gap-2">
            <div className="text-sm font-medium">{t("fields.color")}</div>
            <div className="flex flex-wrap gap-2">
              {colors.map((c) => {
                const stock = variants.filter((v) => (v.color ?? "") === c).reduce((n, v) => n + v.quantity, 0);
                return (
                  <button key={c || "none"} type="button" className={chip((selected.color ?? "") === c, stock === 0)}
                    onClick={() => pick(selected.size ?? "", c)}>
                    {c || "—"}
                  </button>
                );
              })}
            </div>
          </div>
        )}
        {sizes.some(Boolean) && (
          <div className="grid gap-2">
            <div className="text-sm font-medium">{t("fields.size")}</div>
            <div className="flex flex-wrap gap-2">
              {sizes.map((sz) => {
                const match = variants.find((v) => (v.color ?? "") === (selected.color ?? "") && (v.size ?? "") === sz);
                return (
                  <button key={sz || "none"} type="button"
                    className={chip((selected.size ?? "") === sz, !match || match.quantity === 0)}
                    onClick={() => pick(sz, selected.color ?? "")}>
                    {sz || "—"}
                  </button>
                );
              })}
            </div>
          </div>
        )}
        <div className="flex items-center justify-between rounded-lg bg-muted/60 px-3 py-2 text-sm">
          <span><bdi className="font-medium">{variantLabel(selected.size, selected.color) || t("common.standard")}</bdi> · <bdi>{t("sell.inStock", { count: max })}</bdi></span>
          <StockBadge status={selected.stock_status} />
        </div>

        <div className="grid gap-2">
          <div className="text-sm font-medium">{t("fields.quantity")}</div>
          <div className="flex items-center gap-3">
            <Button type="button" variant="outline" size="icon-lg" aria-label={t("common.decrease")}
              disabled={qty <= 1} onClick={() => setQty((q) => Math.max(1, q - 1))}><Minus /></Button>
            <input
              inputMode="numeric" aria-label={t("fields.quantity")}
              className="h-12 w-20 rounded-md border text-center text-xl font-semibold"
              value={qty}
              onChange={(e) => {
                const n = parseInt(e.target.value.replace(/\D/g, ""), 10);
                setQty(Number.isFinite(n) ? Math.max(1, n) : 1);
              }}
            />
            <Button type="button" variant="outline" size="icon-lg" aria-label={t("common.increase")}
              disabled={qty >= max} onClick={() => setQty((q) => Math.min(max, q + 1))}><Plus /></Button>
            <div className="ms-auto text-end">
              <div className="text-xs text-muted-foreground">{t("common.total")}</div>
              <div className="text-xl font-bold">{formatMoney(qty * selected.price_cents)}</div>
            </div>
          </div>
        </div>

        {mode === "sell" && <PaymentPicker state={pay} />}

        {mode === "sell" ? (
          <div className="grid gap-2">
            <Button size="xl" variant="success" disabled={pending || max === 0 || qty > max || !pay.valid} onClick={confirm}>
              {max === 0 ? t("sell.outOfStock") : pending ? t("sell.selling") : t("sell.confirm", { label: `${qty} × ${variantLabel(selected.size, selected.color) || isolate(selected.name)}` })}
            </Button>
            <Button size="lg" variant="outline" disabled={pending || max === 0 || qty > max} onClick={addLine}>
              <ShoppingCart /> {t("cart.addMore")}
            </Button>
          </div>
        ) : (
          <Button size="xl" variant="success" disabled={max === 0 || qty > max} onClick={addLine}>
            <ShoppingCart /> {max === 0 ? t("sell.outOfStock") : t("cart.addToCart", { label: `${qty} × ${variantLabel(selected.size, selected.color) || isolate(selected.name)}` })}
          </Button>
        )}
      </DialogContent>
    </Dialog>
  );
}
