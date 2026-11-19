"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { Minus, Plus } from "lucide-react";
import { toast } from "sonner";
import { sellItem } from "@/app/actions/inventory";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { StockBadge } from "@/components/stock-badge";
import { cn } from "@/lib/utils";
import { formatMoney, STOCK_ORDER, variantLabel } from "@/lib/format";
import type { Item } from "@/lib/types";

/**
 * Fast sale confirmation: pick the variant (size/color), the quantity, confirm.
 * `variants` = all active rows with the same product name in the same store.
 */
export function SellDialog({ item, variants, onClose }: { item: Item | null; variants: Item[]; onClose: () => void }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [qty, setQty] = useState(1);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (item) { setSelectedId(item.id); setQty(1); }
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

  const confirm = () => {
    startTransition(async () => {
      const res = await sellItem({ itemId: selected.id, quantity: qty });
      if (!res.ok) { toast.error(res.error); return; }
      const r = res.data!;
      const v = variantLabel(r.size, r.color);
      toast.success(`Sold ${r.quantity_sold} × ${r.item_name}${v ? ` (${v})` : ""}`, {
        description: `${formatMoney(r.total_cents)} · ${r.quantity_after} left`,
      });
      if (r.status_after !== "OK" && STOCK_ORDER[r.status_after] < STOCK_ORDER[r.status_before]) {
        const msg = r.status_after === "OUT" ? "is now OUT of stock" : r.status_after === "CRITICAL" ? "is critically low" : "is running low";
        toast.warning(`${r.item_name}${v ? ` (${v})` : ""} ${msg}`, {
          description: r.status_after === "OUT" ? "Ask the owner to bring more." : `${r.quantity_after} left`,
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
        <DialogHeader>
          <DialogTitle>Sell {selected.name}</DialogTitle>
          <DialogDescription>{formatMoney(selected.price_cents)} each</DialogDescription>
        </DialogHeader>

        {sizes.some(Boolean) && (
          <div className="grid gap-2">
            <div className="text-sm font-medium">Size</div>
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
            <div className="text-sm font-medium">Color</div>
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
          <span>{variantLabel(selected.size, selected.color) || "Standard"} · <b>{max}</b> in stock</span>
          <StockBadge status={selected.stock_status} />
        </div>

        <div className="grid gap-2">
          <div className="text-sm font-medium">Quantity</div>
          <div className="flex items-center gap-3">
            <Button type="button" variant="outline" size="icon-lg" aria-label="Decrease"
              disabled={qty <= 1} onClick={() => setQty((q) => Math.max(1, q - 1))}><Minus /></Button>
            <input
              inputMode="numeric" aria-label="Quantity"
              className="h-12 w-20 rounded-md border text-center text-xl font-semibold"
              value={qty}
              onChange={(e) => {
                const n = parseInt(e.target.value.replace(/\D/g, ""), 10);
                setQty(Number.isFinite(n) ? Math.max(1, n) : 1);
              }}
            />
            <Button type="button" variant="outline" size="icon-lg" aria-label="Increase"
              disabled={qty >= max} onClick={() => setQty((q) => Math.min(max, q + 1))}><Plus /></Button>
            <div className="ml-auto text-right">
              <div className="text-xs text-muted-foreground">Total</div>
              <div className="text-xl font-bold">{formatMoney(qty * selected.price_cents)}</div>
            </div>
          </div>
        </div>

        <Button size="xl" variant="success" disabled={pending || max === 0 || qty > max} onClick={confirm}>
          {max === 0 ? "Out of stock" : pending ? "Selling…" : `Confirm sale · ${qty} × ${variantLabel(selected.size, selected.color) || selected.name}`}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
