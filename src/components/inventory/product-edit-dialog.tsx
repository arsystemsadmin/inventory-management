"use client";

import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { useActions } from "@/lib/actions-context";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { centsToInput, parseMoneyToCents } from "@/lib/format";
import type { Product } from "@/lib/products";
import { PhotoField } from "./photo-field";
import { useT } from "@/i18n/client";

/**
 * Product-wide edit: name, category, photo, and optionally one price/cost/
 * alert level for every variation. Only fields you change are sent.
 */
export function ProductEditDialog({
  product, onClose, needsApproval, categories,
}: {
  product: Product | null;
  onClose: () => void;
  needsApproval: boolean;
  categories: string[];
}) {
  const actions = useActions();
  const [pending, startTransition] = useTransition();
  const [uploading, setUploading] = useState(false);
  const [f, setF] = useState({ name: "", category: "", price: "", cost: "", threshold: "" });
  const [imagePath, setImagePath] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [confirmZero, setConfirmZero] = useState(false);
  const t = useT();

  const base = product?.variants[0];
  const samePrice = !!product && product.minPrice === product.maxPrice;

  useEffect(() => {
    if (!product || !base) return;
    setF({
      name: product.name, category: product.category ?? "",
      price: samePrice ? centsToInput(base.price_cents) : "",
      cost: product.variants.every((v) => v.cost_cents === base.cost_cents) ? centsToInput(base.cost_cents) : "",
      threshold: product.variants.every((v) => v.low_stock_threshold === base.low_stock_threshold) ? String(base.low_stock_threshold) : "",
    });
    setImagePath(product.image_path);
    setReason("");
    setConfirmZero(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product?.key]);

  if (!product || !base) return null;
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => {
    if (k === "price") setConfirmZero(false);
    setF((s) => ({ ...s, [k]: e.target.value }));
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const changes: Record<string, unknown> = {};
    if (f.name.trim() !== product.name) changes.name = f.name.trim();
    if ((f.category.trim() || null) !== (product.category ?? null)) changes.category = f.category.trim();
    if (imagePath !== product.image_path) changes.image_path = imagePath;
    // Blank price/cost/alert = leave each variation as it is.
    if (f.price.trim()) {
      const p = parseMoneyToCents(f.price);
      if (Number.isNaN(p)) { toast.error(t("form.priceFormat")); return; }
      // Setting every variation to ₪0 needs a second tap.
      if (p === 0 && !confirmZero) { setConfirmZero(true); return; }
      if (product.variants.some((v) => v.price_cents !== p)) changes.price_cents = p;
    }
    if (f.cost.trim()) {
      const c = parseMoneyToCents(f.cost);
      if (Number.isNaN(c)) { toast.error(t("form.priceFormat")); return; }
      if (product.variants.some((v) => v.cost_cents !== c)) changes.cost_cents = c;
    }
    if (f.threshold.trim()) {
      const t = Number(f.threshold);
      if (product.variants.some((v) => v.low_stock_threshold !== t)) changes.low_stock_threshold = t;
    }
    if (!Object.keys(changes).length) { toast.error(t("errors.NO_CHANGES")); return; }
    startTransition(async () => {
      const res = await actions.saveProductEdit({ storeId: product.store_id, name: product.name, changes, reason });
      if (!res.ok) { toast.error(res.error); return; }
      toast.success(res.message);
      onClose();
    });
  };

  return (
    <Dialog open={!!product} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("form.editTitle", { name: product.name })}</DialogTitle>
          <DialogDescription>
            {t("productEdit.appliesTo", { count: product.variants.length })}
            {needsApproval && ` ${t("productEdit.approvalNote")}`}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="grid gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="p-name">{t("form.productName")}</Label>
            <Input id="p-name" value={f.name} onChange={set("name")} required maxLength={200} />
          </div>
          <PhotoField value={imagePath} onChange={setImagePath} businessId={base.business_id} storeId={product.store_id} onUploadingChange={setUploading} />
          <div className="grid gap-1.5">
            <Label htmlFor="p-category">{t("fields.category")}</Label>
            <Input id="p-category" list="p-category-options" value={f.category} onChange={set("category")} maxLength={100} />
            <datalist id="p-category-options">{categories.map((c) => <option key={c} value={c} />)}</datalist>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="p-price">{t("form.priceLabel")}</Label>
              <Input id="p-price" inputMode="decimal" value={f.price} onChange={set("price")} placeholder={samePrice ? "" : t("productEdit.varies")} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="p-cost">{t("form.costLabel")}</Label>
              <Input id="p-cost" inputMode="decimal" value={f.cost} onChange={set("cost")} placeholder={t("productEdit.varies")} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="p-threshold">{t("productEdit.alertAt")}</Label>
              <Input id="p-threshold" inputMode="numeric" value={f.threshold} onChange={set("threshold")} placeholder={t("productEdit.varies")} />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">{t("productEdit.note")}</p>
          {confirmZero && (
            <p role="alert" className="rounded-md border border-amber-300 bg-amber-50 p-2.5 text-sm text-amber-900">
              {t("form.zeroPriceWarningAll")}
            </p>
          )}
          {needsApproval && (
            <div className="grid gap-1.5">
              <Label htmlFor="p-reason">{t("form.reasonForOwner")}</Label>
              <Textarea id="p-reason" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} />
            </div>
          )}
          {/* Always reachable: stays at the bottom of the sheet while the fields scroll. */}
          <div className="sticky -bottom-5 -mx-5 border-t bg-background px-5 pt-3 pb-5">
            <Button type="submit" size="lg" className="w-full" disabled={pending || uploading}>
              {pending ? t("common.saving") : confirmZero ? t("form.saveAtZero") : needsApproval ? t("productEdit.saveOrRequest") : t("productEdit.saveAll")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
