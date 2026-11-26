"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { useActions } from "@/lib/actions-context";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { centsToInput, parseMoneyToCents, variantLabel } from "@/lib/format";
import type { Product } from "@/lib/products";
import type { Item } from "@/lib/types";
import { PhotoField } from "./photo-field";
import { SizeQuantityPicker, type SizeRow } from "./size-quantity-picker";
import { useT } from "@/i18n/client";

type StoreOpt = { id: string; name: string; business_id: string };

const empty = { name: "", sku: "", category: "", size: "", color: "", price: "", cost: "", quantity: "1", threshold: "3" };

/**
 * Three modes:
 *  - new product:     name, photo, category, color, sizes (+qty each), price…
 *  - add variations:  `product` given; name/category/photo come from it
 *  - edit variation:  `item` given; size, color, price, cost, alert, SKU
 */
export function ItemFormDialog({
  open, onClose, item, product, stores, defaultStoreId, needsApproval, categories,
}: {
  open: boolean;
  onClose: () => void;
  item?: Item | null;
  product?: Product | null;
  stores: StoreOpt[];
  defaultStoreId?: string;
  needsApproval: (storeId: string) => boolean;
  categories: string[];
}) {
  const [f, setF] = useState(empty);
  const [storeId, setStoreId] = useState(defaultStoreId ?? stores[0]?.id ?? "");
  const [reason, setReason] = useState("");
  const [sizes, setSizes] = useState<SizeRow[]>([]);
  const [imagePath, setImagePath] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [showErrors, setShowErrors] = useState(false);
  const [pending, startTransition] = useTransition();
  const actions = useActions();
  const t = useT();
  const colorRef = useRef<HTMLInputElement>(null);

  const mode: "new" | "variations" | "edit" = item ? "edit" : product ? "variations" : "new";

  useEffect(() => {
    if (!open) return;
    setReason("");
    setSizes([]);
    setShowErrors(false);
    if (item) {
      setStoreId(item.store_id);
      setImagePath(item.image_path ?? null);
      setF({
        name: item.name, sku: item.sku ?? "", category: item.category ?? "", size: item.size ?? "", color: item.color ?? "",
        price: centsToInput(item.price_cents), cost: centsToInput(item.cost_cents), quantity: String(item.quantity),
        threshold: String(item.low_stock_threshold),
      });
    } else if (product) {
      const base = product.variants[0];
      setStoreId(product.store_id);
      setImagePath(product.image_path);
      setF({
        ...empty, name: product.name, category: product.category ?? "",
        price: centsToInput(base.price_cents), cost: centsToInput(base.cost_cents), threshold: String(base.low_stock_threshold),
      });
    } else {
      setF(empty);
      setImagePath(null);
      setStoreId(defaultStoreId ?? stores[0]?.id ?? "");
    }
    // Only reset when the dialog opens or switches target, not when a live
    // refresh hands us new props (that would wipe "Save & add another").
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, item?.id, product?.key]);

  const set = (k: keyof typeof empty) => (e: React.ChangeEvent<HTMLInputElement>) => setF((s) => ({ ...s, [k]: e.target.value }));
  const approval = mode === "edit" && needsApproval(item!.store_id);
  const businessId = item?.business_id ?? product?.variants[0].business_id ?? stores.find((x) => x.id === storeId)?.business_id;

  // The details that matter for selling and stock: name, color, size(s), price.
  const missing = {
    name: mode === "new" && !f.name.trim(),
    color: mode !== "edit" && !f.color.trim(),
    sizes: mode !== "edit" && sizes.length === 0,
    price: !f.price.trim(),
  };
  const req = <span className="text-destructive" aria-hidden> *</span>;
  const errorFor = (k: keyof typeof missing) =>
    showErrors && missing[k] ? <p className="text-xs font-medium text-destructive">{t("form.required")}</p> : null;

  const submit = (addAnother: boolean) => {
    if (Object.values(missing).some(Boolean)) {
      setShowErrors(true);
      toast.error(t("form.fillRequired"));
      return;
    }
    const price = parseMoneyToCents(f.price || "0");
    const cost = parseMoneyToCents(f.cost || "0");
    if (Number.isNaN(price) || Number.isNaN(cost)) { toast.error(t("form.priceFormat")); return; }

    startTransition(async () => {
      if (mode === "edit") {
        const fields = {
          sku: f.sku, size: f.size, color: f.color, price_cents: price, cost_cents: cost, low_stock_threshold: Number(f.threshold || 0),
        };
        const before: Record<string, unknown> = {
          sku: item!.sku ?? "", size: item!.size ?? "", color: item!.color ?? "", price_cents: item!.price_cents,
          cost_cents: item!.cost_cents, low_stock_threshold: item!.low_stock_threshold,
        };
        const changes = Object.fromEntries(Object.entries(fields).filter(([k, v]) => before[k] !== v));
        const res = await actions.saveItemEdit({ itemId: item!.id, changes, reason });
        if (!res.ok) { toast.error(res.error); return; }
        toast.success(res.message);
        onClose();
        return;
      }

      // New product or more variations: one variation per selected size (each
      // with its own quantity), or a single variation without a size.
      const shared = {
        name: f.name, category: f.category, color: f.color, image_path: imagePath, store_id: storeId,
        price_cents: price, cost_cents: cost, low_stock_threshold: Number(f.threshold || 0),
      };
      const sku = f.sku.trim();
      const skuFor = (size: string) => (sku ? `${sku}-${size.replace(/\s+/g, "").toUpperCase()}`.slice(0, 64) : "");
      const rows = sizes.length
        // A photo picked for a row belongs to that exact variation (this size in this color);
        // rows without one simply show the product photo.
        ? sizes.map((r) => ({ ...shared, size: r.size, sku: skuFor(r.size), quantity: Number(r.qty || 0),
            variation_image_path: r.photo && r.photo !== imagePath ? r.photo : null }))
        : [{ ...shared, size: "", sku, quantity: Number(f.quantity || 0) }];
      const res = await actions.createItems(rows);
      if (!res.ok) { toast.error(res.error); return; }
      const color = f.color ? ` · ${f.color}` : "";
      // Some sizes already existed: say exactly which were skipped.
      if (res.data?.skipped.length) toast.warning(res.message);
      else toast.success(sizes.length
        ? t("form.addedSizes", { name: `${f.name}${color}`, count: sizes.length, sizes: sizes.map((r) => r.size).join(", ") })
        : t("form.added", { name: `${f.name}${color}` }));
      if (addAnother) {
        // Same product in another color: keep details and sizes, reset color, quantities and
        // photos (each size goes back to showing the product photo, or none).
        setF((s) => ({ ...s, sku: "", color: "", quantity: "1" }));
        setSizes((rs) => rs.map((r) => ({ ...r, qty: "1", photo: null })));
        colorRef.current?.focus();
      } else {
        onClose();
      }
    });
  };

  const title = mode === "edit"
    ? t("form.editTitle", { name: `${item!.name}${variantLabel(item!.size, item!.color) ? ` · ${variantLabel(item!.size, item!.color)}` : ""}` })
    : mode === "variations" ? t("form.addVariationsTitle", { name: product!.name }) : t("inventory.addProduct");
  const description = approval
    ? t("form.needsApprovalNote")
    : mode === "edit" ? t("form.editNote")
    : mode === "variations" ? t("form.variationsNote")
    : t("form.newNote");

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <form className="grid gap-3" onSubmit={(e) => { e.preventDefault(); submit(false); }}>
          {mode === "new" && stores.length > 1 && (
            <div className="grid gap-1.5">
              <Label htmlFor="store">{t("dashboard.store")}</Label>
              <NativeSelect id="store" value={storeId} onChange={(e) => setStoreId(e.target.value)}>
                {stores.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </NativeSelect>
            </div>
          )}
          {mode === "new" && (
            <>
              <div className="grid gap-1.5">
                <Label htmlFor="name">{t("form.productName")}{req}</Label>
                <Input id="name" value={f.name} onChange={set("name")} required maxLength={200} placeholder={t("form.namePlaceholder")}
                  aria-invalid={showErrors && missing.name} />
                {errorFor("name")}
              </div>
              <PhotoField value={imagePath} onChange={setImagePath} businessId={businessId} storeId={storeId} onUploadingChange={setUploading} />
            </>
          )}

          {mode === "edit" ? (
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="size">{t("fields.size")}</Label>
                <Input id="size" value={f.size} onChange={set("size")} maxLength={40} placeholder="XS, S, M, L, XL…" />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="color">{t("fields.color")}</Label>
                <Input id="color" ref={colorRef} value={f.color} onChange={set("color")} maxLength={40} placeholder={t("form.colorPlaceholder")} />
              </div>
            </div>
          ) : (
            <>
              <div className="grid gap-1.5">
                <Label htmlFor="color">{t("fields.color")}{req}</Label>
                <Input id="color" ref={colorRef} value={f.color} onChange={set("color")} maxLength={40} placeholder={t("form.colorPlaceholder")}
                  aria-invalid={showErrors && missing.color} />
                {errorFor("color")}
              </div>
              <div className="grid gap-1.5">
                <Label>{t("form.sizes")}{req} <span className="font-normal text-muted-foreground">{t("form.sizesHint")}</span></Label>
                <SizeQuantityPicker rows={sizes} onChange={setSizes} businessId={businessId} storeId={storeId} defaultPhoto={imagePath} />
                {errorFor("sizes")}
              </div>
            </>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="price">{t("form.priceLabel")}{req}</Label>
              <Input id="price" inputMode="decimal" value={f.price} onChange={set("price")} required placeholder="0.00"
                aria-invalid={showErrors && missing.price} />
              {errorFor("price")}
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="cost">{t("form.costLabel")}</Label>
              <Input id="cost" inputMode="decimal" value={f.cost} onChange={set("cost")} placeholder="0.00" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="threshold">{t("form.alertAt")}</Label>
              <Input id="threshold" inputMode="numeric" value={f.threshold} onChange={set("threshold")} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {mode === "new" && (
              <div className="grid gap-1.5">
                <Label htmlFor="category">{t("fields.category")}</Label>
                <Input id="category" list="category-options" value={f.category} onChange={set("category")} maxLength={100} />
                <datalist id="category-options">{categories.map((c) => <option key={c} value={c} />)}</datalist>
              </div>
            )}
            <div className="grid gap-1.5">
              <Label htmlFor="sku">{t("fields.sku")}</Label>
              <Input id="sku" value={f.sku} onChange={set("sku")} maxLength={58}
                placeholder={mode !== "edit" && sizes.length ? t("form.skuHint") : ""} />
            </div>
          </div>
          {approval && (
            <div className="grid gap-1.5">
              <Label htmlFor="reason">{t("form.reasonForOwner")}</Label>
              <Textarea id="reason" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} placeholder={t("form.reasonPlaceholder")} />
            </div>
          )}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end pt-1">
            {mode !== "edit" && (
              <Button type="button" variant="outline" size="lg" disabled={pending || uploading} onClick={() => submit(true)}>
                {t("form.saveAndAddColor")}
              </Button>
            )}
            <Button type="submit" size="lg" disabled={pending || uploading}>
              {pending ? t("common.saving") : approval ? t("common.requestApproval") : t("common.save")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
