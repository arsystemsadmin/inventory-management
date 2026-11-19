"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { ImageIcon, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useActions } from "@/lib/actions-context";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { centsToInput, parseMoneyToCents } from "@/lib/format";
import type { Item } from "@/lib/types";
import { SizeQuantityPicker, type SizeRow } from "./size-quantity-picker";
import { itemImageUrl, uploadItemImage } from "@/lib/item-images";

type StoreOpt = { id: string; name: string; business_id: string };

const empty = { name: "", sku: "", category: "", size: "", color: "", price: "", cost: "", quantity: "", threshold: "3" };

export function ItemFormDialog({
  open, onClose, item, stores, defaultStoreId, needsApproval, categories,
}: {
  open: boolean;
  onClose: () => void;
  item?: Item | null; // edit mode when set
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
  const nameRef = useRef<HTMLInputElement>(null);
  const colorRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setReason("");
    setSizes([]);
    setImagePath(item?.image_path ?? null);
    if (item) {
      setStoreId(item.store_id);
      setF({
        name: item.name, sku: item.sku ?? "", category: item.category ?? "", size: item.size ?? "", color: item.color ?? "",
        price: centsToInput(item.price_cents), cost: centsToInput(item.cost_cents), quantity: String(item.quantity),
        threshold: String(item.low_stock_threshold),
      });
    } else {
      setF(empty);
      setStoreId(defaultStoreId ?? stores[0]?.id ?? "");
    }
    // Only reset when the dialog opens or switches item, not when a live
    // refresh hands us new props (that would wipe "Save & add another").
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, item?.id]);

  const set = (k: keyof typeof empty) => (e: React.ChangeEvent<HTMLInputElement>) => setF((s) => ({ ...s, [k]: e.target.value }));
  const approval = !!item && needsApproval(item.store_id);

  const onPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow picking the same file again
    if (!file) return;
    const targetStore = item?.store_id ?? storeId;
    const businessId = item?.business_id ?? stores.find((x) => x.id === targetStore)?.business_id;
    if (!targetStore || !businessId) { toast.error("Pick a store first"); return; }
    setUploading(true);
    const res = await uploadItemImage(file, businessId, targetStore);
    setUploading(false);
    if (res.ok) setImagePath(res.path); else toast.error(res.error);
  };
  const photoUrl = itemImageUrl(imagePath);

  const submit = (addAnother: boolean) => {
    const price = parseMoneyToCents(f.price || "0");
    const cost = parseMoneyToCents(f.cost || "0");
    if (Number.isNaN(price) || Number.isNaN(cost)) { toast.error("Enter prices like 12.50"); return; }
    const fields = {
      name: f.name, sku: f.sku, category: f.category, size: f.size, color: f.color,
      price_cents: price, cost_cents: cost, low_stock_threshold: Number(f.threshold || 0), image_path: imagePath,
    };
    startTransition(async () => {
      if (item) {
        // Send only what changed.
        const before: Record<string, unknown> = {
          name: item.name, sku: item.sku ?? "", category: item.category ?? "", size: item.size ?? "", color: item.color ?? "",
          price_cents: item.price_cents, cost_cents: item.cost_cents, low_stock_threshold: item.low_stock_threshold,
          image_path: item.image_path ?? null,
        };
        const changes = Object.fromEntries(Object.entries(fields).filter(([k, v]) => before[k] !== v));
        const res = await actions.saveItemEdit({ itemId: item.id, changes, reason });
        if (!res.ok) { toast.error(res.error); return; }
        toast.success(res.message);
        onClose();
        return;
      }
      // One item per selected size (each with its own quantity), or a single
      // item without a size when none are picked.
      const sku = f.sku.trim();
      const skuFor = (size: string) => (sku ? `${sku}-${size.replace(/\s+/g, "").toUpperCase()}`.slice(0, 64) : "");
      const rows = sizes.length
        ? sizes.map((r) => ({ ...fields, size: r.size, sku: skuFor(r.size), store_id: storeId, quantity: Number(r.qty || 0) }))
        : [{ ...fields, size: "", store_id: storeId, quantity: Number(f.quantity || 0) }];
      const res = await actions.createItems(rows);
      if (!res.ok) { toast.error(res.error); return; }
      const color = f.color ? ` · ${f.color}` : "";
      toast.success(sizes.length
        ? `Added ${f.name}${color} in ${sizes.length} size${sizes.length === 1 ? "" : "s"} (${sizes.map((r) => r.size).join(", ")})`
        : `Added ${f.name}${color}`);
      if (addAnother) {
        // Same product in another color: keep details and sizes, reset color and quantities.
        setF((s) => ({ ...s, sku: "", color: "", quantity: "" }));
        setImagePath(null);
        setSizes((rs) => rs.map((r) => ({ ...r, qty: "1" })));
        colorRef.current?.focus();
      } else {
        onClose();
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{item ? "Edit item" : "Add item"}</DialogTitle>
          <DialogDescription>
            {approval
              ? "Setup is finished for this store, so the owner must approve changes."
              : item ? "Changes apply immediately." : "Pick every size you have and set how many of each. Each size gets its own stock."}
          </DialogDescription>
        </DialogHeader>
        <form className="grid gap-3" onSubmit={(e) => { e.preventDefault(); submit(false); }}>
          {!item && stores.length > 1 && (
            <div className="grid gap-1.5">
              <Label htmlFor="store">Store</Label>
              <NativeSelect id="store" value={storeId} onChange={(e) => setStoreId(e.target.value)}>
                {stores.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </NativeSelect>
            </div>
          )}
          <div className="grid gap-1.5">
            <Label htmlFor="name">Name</Label>
            <Input id="name" ref={nameRef} value={f.name} onChange={set("name")} required maxLength={200} placeholder="e.g. Linen Shirt" />
          </div>
          <div className="grid gap-1.5">
            <Label>Photo <span className="font-normal text-muted-foreground">(optional)</span></Label>
            <div className="flex items-center gap-3">
              <div className="grid size-20 shrink-0 place-items-center overflow-hidden rounded-lg border bg-muted">
                {uploading ? <Loader2 className="size-5 animate-spin text-muted-foreground" />
                  : photoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element -- user photos; no image optimizer on Workers
                    <img src={photoUrl} alt="Item photo" className="size-full object-cover" />
                  ) : <ImageIcon className="size-6 text-muted-foreground" />}
              </div>
              <div className="flex flex-col items-start gap-1.5">
                <label className="inline-flex h-10 cursor-pointer items-center rounded-md border px-4 text-sm font-medium hover:bg-muted">
                  {photoUrl ? "Change photo" : "Add photo"}
                  <input type="file" accept="image/*" className="sr-only" onChange={onPhoto} disabled={uploading} />
                </label>
                {photoUrl && !uploading && (
                  <button type="button" className="text-sm text-muted-foreground underline" onClick={() => setImagePath(null)}>Remove photo</button>
                )}
              </div>
            </div>
          </div>
          {item ? (
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="size">Size</Label>
                <Input id="size" value={f.size} onChange={set("size")} maxLength={40} placeholder="S, M, 32…" />
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
            {!item && sizes.length === 0 && (
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
            <div className="grid gap-1.5">
              <Label htmlFor="category">Category</Label>
              <Input id="category" list="category-options" value={f.category} onChange={set("category")} maxLength={100} />
              <datalist id="category-options">{categories.map((c) => <option key={c} value={c} />)}</datalist>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="sku">SKU</Label>
              <Input id="sku" value={f.sku} onChange={set("sku")} maxLength={58} placeholder={sizes.length ? "Size is added, e.g. LS-NVY-M" : ""} />
            </div>
          </div>
          {approval && (
            <div className="grid gap-1.5">
              <Label htmlFor="reason">Reason for the owner</Label>
              <Textarea id="reason" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} placeholder="e.g. wrong price on tag" />
            </div>
          )}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end pt-1">
            {!item && (
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
