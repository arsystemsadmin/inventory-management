"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { createItem, saveItemEdit } from "@/app/actions/inventory";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { centsToInput, parseMoneyToCents } from "@/lib/format";
import type { Item } from "@/lib/types";

type StoreOpt = { id: string; name: string };

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
  const [pending, startTransition] = useTransition();
  const nameRef = useRef<HTMLInputElement>(null);
  const sizeRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setReason("");
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

  const submit = (addAnother: boolean) => {
    const price = parseMoneyToCents(f.price || "0");
    const cost = parseMoneyToCents(f.cost || "0");
    if (Number.isNaN(price) || Number.isNaN(cost)) { toast.error("Enter prices like 12.50"); return; }
    const fields = {
      name: f.name, sku: f.sku, category: f.category, size: f.size, color: f.color,
      price_cents: price, cost_cents: cost, low_stock_threshold: Number(f.threshold || 0),
    };
    startTransition(async () => {
      if (item) {
        // Send only what changed.
        const before: Record<string, unknown> = {
          name: item.name, sku: item.sku ?? "", category: item.category ?? "", size: item.size ?? "", color: item.color ?? "",
          price_cents: item.price_cents, cost_cents: item.cost_cents, low_stock_threshold: item.low_stock_threshold,
        };
        const changes = Object.fromEntries(Object.entries(fields).filter(([k, v]) => before[k] !== v));
        const res = await saveItemEdit({ itemId: item.id, changes, reason });
        if (!res.ok) { toast.error(res.error); return; }
        toast.success(res.message);
        onClose();
        return;
      }
      const res = await createItem({ ...fields, store_id: storeId, quantity: Number(f.quantity || 0) });
      if (!res.ok) { toast.error(res.error); return; }
      toast.success(`Added ${f.name}${f.size || f.color ? ` (${[f.size, f.color].filter(Boolean).join(" · ")})` : ""}`);
      if (addAnother) {
        // Keep product details; clear the variant-specific fields for the next size/color.
        setF((s) => ({ ...s, sku: "", size: "", color: s.color, quantity: "" }));
        sizeRef.current?.focus();
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
              : item ? "Changes apply immediately." : "Each size/color combination is its own item with its own stock."}
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
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="size">Size</Label>
              <Input id="size" ref={sizeRef} value={f.size} onChange={set("size")} maxLength={40} placeholder="S, M, 32…" />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="color">Color</Label>
              <Input id="color" value={f.color} onChange={set("color")} maxLength={40} placeholder="Black" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="price">Price ($)</Label>
              <Input id="price" inputMode="decimal" value={f.price} onChange={set("price")} required placeholder="0.00" />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="cost">Cost ($)</Label>
              <Input id="cost" inputMode="decimal" value={f.cost} onChange={set("cost")} placeholder="0.00" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {!item && (
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
              <Input id="sku" value={f.sku} onChange={set("sku")} maxLength={64} />
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
              <Button type="button" variant="outline" size="lg" disabled={pending} onClick={() => submit(true)}>
                Save &amp; add another size/color
              </Button>
            )}
            <Button type="submit" size="lg" disabled={pending}>
              {pending ? "Saving…" : approval ? "Request approval" : "Save"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
