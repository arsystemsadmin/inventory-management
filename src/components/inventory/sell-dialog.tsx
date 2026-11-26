"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { Banknote, CreditCard, Minus, Plus, Split } from "lucide-react";
import { toast } from "sonner";
import { useActions } from "@/lib/actions-context";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { StockBadge } from "@/components/stock-badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ItemThumb } from "./item-thumb";
import { cn } from "@/lib/utils";
import { centsToInput, formatMoney, parseMoneyToCents, STOCK_ORDER, variantLabel } from "@/lib/format";
import { PAYMENT_METHODS, type Item, type PaymentMethod } from "@/lib/types";
import { useT } from "@/i18n/client";

/**
 * Fast sale confirmation: pick the variant (size/color), the quantity, confirm.
 * `variants` = all active rows with the same product name in the same store.
 */
export function SellDialog({ item, variants, onClose }: { item: Item | null; variants: Item[]; onClose: () => void }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [qty, setQty] = useState(1);
  // Payment: cash / credit need no amount; split asks for both parts.
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [splitEdit, setSplitEdit] = useState<{ field: "cash" | "credit"; text: string }>({ field: "cash", text: "" });
  const [pending, startTransition] = useTransition();
  const actions = useActions();
  const t = useT();

  useEffect(() => {
    if (item) { setSelectedId(item.id); setQty(1); setMethod("cash"); setSplitEdit({ field: "cash", text: "" }); }
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
      ?? variants.find((v) => (v.size ?? "") === size)
      ?? variants.find((v) => (v.color ?? "") === color);
    if (match) { setSelectedId(match.id); setQty(1); }
  };

  // Split amounts: the field being typed in is kept as typed; the other one is
  // always "total minus that", so the two parts can't disagree with the total.
  const total = qty * selected.price_cents;
  const typed = parseMoneyToCents(splitEdit.text || "x");
  const typedOk = Number.isFinite(typed) && typed > 0 && typed < total;
  const cashCents = splitEdit.field === "cash" ? typed : total - typed;
  const splitValid = method !== "split" || typedOk;
  const cashText = splitEdit.field === "cash" ? splitEdit.text : typedOk ? centsToInput(total - typed) : "";
  const creditText = splitEdit.field === "credit" ? splitEdit.text : typedOk ? centsToInput(total - typed) : "";
  const PAY_ICONS = { cash: Banknote, credit: CreditCard, split: Split };

  const confirm = () => {
    if (!splitValid) return;
    startTransition(async () => {
      const res = await actions.sellItem({
        itemId: selected.id, quantity: qty,
        payment: method === "split" ? { method, cash_cents: cashCents } : { method },
      });
      if (!res.ok) { toast.error(res.error); return; }
      const r = res.data!;
      const v = variantLabel(r.size, r.color);
      toast.success(t("sell.sold", { label: `${r.quantity_sold} × ${r.item_name}${v ? ` (${v})` : ""}` }), {
        description: `${formatMoney(r.total_cents)} · ${t(`payment.${method}`)} · ${t("common.left", { count: r.quantity_after })}`,
      });
      if (r.status_after !== "OK" && STOCK_ORDER[r.status_after] < STOCK_ORDER[r.status_before]) {
        const name = `${r.item_name}${v ? ` (${v})` : ""}`;
        const msg = r.status_after === "OUT" ? t("sell.nowOut", { name }) : r.status_after === "CRITICAL" ? t("sell.nowCritical", { name }) : t("sell.nowLow", { name });
        toast.warning(msg, {
          description: r.status_after === "OUT" ? t("sell.askOwner") : t("common.left", { count: r.quantity_after }),
          duration: 8000,
        });
      }
      onClose();
    });
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
            <DialogTitle>{t("sell.title", { name: selected.name })}</DialogTitle>
            <DialogDescription>{t("sales.each", { price: formatMoney(selected.price_cents) })}</DialogDescription>
          </div>
        </DialogHeader>

        {sizes.some(Boolean) && (
          <div className="grid gap-2">
            <div className="text-sm font-medium">{t("fields.size")}</div>
            <div className="flex flex-wrap gap-2">
              {sizes.map((s) => {
                const any = variants.filter((v) => (v.size ?? "") === s);
                const stock = any.reduce((n, v) => n + v.quantity, 0);
                return (
                  <button key={s || "none"} type="button" className={chip((selected.size ?? "") === s, stock === 0)}
                    onClick={() => pick(s, selected.color ?? "")}>
                    {s || "—"}
                  </button>
                );
              })}
            </div>
          </div>
        )}
        {colors.some(Boolean) && (
          <div className="grid gap-2">
            <div className="text-sm font-medium">{t("fields.color")}</div>
            <div className="flex flex-wrap gap-2">
              {colors.map((c) => {
                const match = variants.find((v) => (v.size ?? "") === (selected.size ?? "") && (v.color ?? "") === c);
                return (
                  <button key={c || "none"} type="button"
                    className={chip((selected.color ?? "") === c, !match || match.quantity === 0)}
                    onClick={() => pick(selected.size ?? "", c)}>
                    {c || "—"}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="flex items-center justify-between rounded-lg bg-muted/60 px-3 py-2 text-sm">
          <span>{variantLabel(selected.size, selected.color) || t("common.standard")} · {t("sell.inStock", { count: max })}</span>
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

        <div className="grid gap-2">
          <div className="text-sm font-medium">{t("payment.method")}</div>
          <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label={t("payment.method")}>
            {PAYMENT_METHODS.map((m) => {
              const Icon = PAY_ICONS[m];
              return (
                <button
                  key={m}
                  type="button"
                  role="radio"
                  aria-checked={method === m}
                  onClick={() => setMethod(m)}
                  className={cn(
                    "flex min-h-11 items-center justify-center gap-1.5 rounded-lg border px-2 text-sm font-semibold transition-colors",
                    method === m ? "border-foreground bg-foreground text-background" : "bg-background hover:bg-muted",
                  )}
                >
                  <Icon className="size-4" /> {t(`payment.${m}`)}
                </button>
              );
            })}
          </div>
          {method === "split" && (
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="pay-cash">{t("payment.cashAmount")}</Label>
                <Input id="pay-cash" inputMode="decimal" autoFocus value={cashText} placeholder="0.00"
                  onChange={(e) => setSplitEdit({ field: "cash", text: e.target.value })} />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="pay-credit">{t("payment.creditAmount")}</Label>
                <Input id="pay-credit" inputMode="decimal" value={creditText} placeholder="0.00"
                  onChange={(e) => setSplitEdit({ field: "credit", text: e.target.value })} />
              </div>
              {!splitValid && (
                <p className="col-span-2 text-xs text-destructive">{t("payment.splitMustMatch", { total: formatMoney(total) })}</p>
              )}
            </div>
          )}
        </div>

        <Button size="xl" variant="success" disabled={pending || max === 0 || qty > max || !splitValid} onClick={confirm}>
          {max === 0 ? t("sell.outOfStock") : pending ? t("sell.selling") : t("sell.confirm", { label: `${qty} × ${variantLabel(selected.size, selected.color) || selected.name}` })}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
