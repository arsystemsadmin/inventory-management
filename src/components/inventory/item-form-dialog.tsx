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
  const [pending, startTransition] = useTransition();
  const actions = useActions();
  const colorRef = useRef<HTMLInputElement>(null);

  const mode: "new" | "variations" | "edit" = item ? "edit" : product ? "variations" : "new";

  useEffect(() => {
    if (!open) return;
    setReason("");
    setSizes([]);
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

  const submit = (addAnother: boolean) => {
    const price = parseMoneyToCents(f.price || "0");
    const cost = parseMoneyToCents(f.cost || "0");
    if (Number.isNaN(price) || Number.isNaN(cost)) { toast.error("Enter prices like 12.50"); return; }

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
        ? sizes.map((r) => ({ ...shared, size: r.size, sku: skuFor(r.size), quantity: Number(r.qty || 0) }))
        : [{ ...shared, size: "", sku, quantity: Number(f.quantity || 0) }];
      const res = await actions.createItems(rows);
      if (!res.ok) { toast.error(res.error); return; }
      const color = f.color ? ` · ${f.color}` : "";
      toast.success(sizes.length
        ? `Added ${f.name}${color} in ${sizes.length} size${sizes.length === 1 ? "" : "s"} (${sizes.map((r) => r.size).join(", ")})`
        : `Added ${f.name}${color}`);
      if (addAnother) {
        // Same product in another color: keep details and sizes, reset color and quantities.
        setF((s) => ({ ...s, sku: "", color: "", quantity: "1" }));
        setSizes((rs) => rs.map((r) => ({ ...r, qty: "1" })));
        colorRef.current?.focus();
      } else {
        onClose();
      }
    });
  };

  const title = mode === "edit"
    ? `Edit ${item!.name}${variantLabel(item!.size, item!.color) ? ` · ${variantLabel(item!.size, item!.color)}` : ""}`
    : mode === "variations" ? `Add variations to ${product!.name}` : "Add product";
  const description = approval
    ? "Setup is finished for this store, so the owner must approve changes."
    : mode === "edit" ? "Changes apply to this variation only. Use “Edit product” to change the name, photo or category."
    : mode === "variations" ? "Pick a color and the sizes to add, with how many of each."
    : "Pick a color and every size you have, with how many of each. They're saved as variations of this product.";

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
              <Label htmlFor="store">Store</Label>
              <NativeSelect id="store" value={storeId} onChange={(e) => setStoreId(e.target.value)}>
                {stores.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </NativeSelect>
            </div>
          )}
          {mode === "new" && (
            <>
              <div className="grid gap-1.5">
                <Label htmlFor="name">Product name</Label>
                <Input id="name" value={f.name} onChange={set("name")} required maxLength={200} placeholder="e.g. Linen Shirt" />
              </div>
              <PhotoField value={imagePath} onChange={setImagePath} businessId={businessId} storeId={storeId} onUploadingChange={setUploading} />
            </>
          )}

          {mode === "edit" ? (
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="size">Size</Label>
                <Input id="size" value={f.size} onChange={set("size")} maxLength={40} placeholder="XS, S, M, L, XL…" />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="color">Color</Label>
                <Input id="color" ref={colorRef} value={f.color} onChange={set("color")} maxLength={40} placeholder="Black" />
              </div>
            </div>
          ) : (
            <>
              <div className="grid gap-1.5">
                <Label htmlFor="color">Color</Label>
                <Input id="color" ref={colorRef} value={f.color} onChange={set("color")} maxLength={40} placeholder="Black" />
              </div>
              <div className="grid gap-1.5">
                <Label>Sizes <span className="font-normal text-muted-foreground">(tap each size you have)</span></Label>
                <SizeQuantityPicker rows={sizes} onChange={setSizes} />
              </div>
            </>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="price">Price (₪)</Label>
              <Input id="price" inputMode="decimal" value={f.price} onChange={set("price")} required placeholder="0.00" />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="cost">Cost (₪)</Label>
              <Input id="cost" inputMode="decimal" value={f.cost} onChange={set("cost")} placeholder="0.00" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {mode !== "edit" && sizes.length === 0 && (
              <div className="grid gap-1.5">
                <Label htmlFor="quantity">Quantity</Label>
                <Input id="quantity" inputMode="numeric" value={f.quantity} onChange={set("quantity")} placeholder="0" />
              </div>
            )}
            <div className="grid gap-1.5">
              <Label htmlFor="threshold">Low-stock alert at</Label>
              <Input id="threshold" inputMode="numeric" value={f.threshold} onChange={set("threshold")} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {mode === "new" && (
              <div className="grid gap-1.5">
                <Label htmlFor="category">Category</Label>
                <Input id="category" list="category-options" value={f.category} onChange={set("category")} maxLength={100} />
                <datalist id="category-options">{categories.map((c) => <option key={c} value={c} />)}</datalist>
              </div>
            )}
            <div className="grid gap-1.5">
              <Label htmlFor="sku">SKU</Label>
              <Input id="sku" value={f.sku} onChange={set("sku")} maxLength={58}
                placeholder={mode !== "edit" && sizes.length ? "Size is added, e.g. LS-NVY-M" : ""} />
            </div>
          </div>
          {approval && (
            <div className="grid gap-1.5">
              <Label htmlFor="reason">Reason for the owner</Label>
              <Textarea id="reason" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} placeholder="e.g. wrong price on tag" />
            </div>
          )}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end pt-1">
            {mode !== "edit" && (
              <Button type="button" variant="outline" size="lg" disabled={pending || uploading} onClick={() => submit(true)}>
                Save &amp; add another color
              </Button>
            )}
            <Button type="submit" size="lg" disabled={pending || uploading}>
              {pending ? "Saving…" : approval ? "Request approval" : "Save"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
