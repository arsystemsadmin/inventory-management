"use client";

import { useEffect, useState, useTransition } from "react";
import { Minus, Plus } from "lucide-react";
import { toast } from "sonner";
import { useActions } from "@/lib/actions-context";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { variantLabel } from "@/lib/format";
import type { Item } from "@/lib/types";

/**
 * Set the stock for one variation (one color of one size). Increases are
 * added right away; decreases follow the usual rule (direct for the owner or
 * during setup, otherwise sent to the owner for approval).
 */
export function QuantityDialog({ item, onClose, needsApproval }: { item: Item | null; onClose: () => void; needsApproval: boolean }) {
  const actions = useActions();
  const [qty, setQty] = useState(0);
  const [reason, setReason] = useState("");
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (item) { setQty(item.quantity); setReason(""); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item?.id]);
  if (!item) return null;

  const delta = qty - item.quantity;
  const label = variantLabel(item.size, item.color) || "Standard";

  const save = () => startTransition(async () => {
    if (delta === 0) { onClose(); return; }
    const res = delta > 0
      ? await actions.addStock({ itemId: item.id, quantity: delta })
      : await actions.removeStock({ itemId: item.id, quantity: -delta, reason });
    if (!res.ok) { toast.error(res.error); return; }
    toast.success(res.message);
    onClose();
  });

  return (
    <Dialog open={!!item} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{item.name} · {label}</DialogTitle>
          <DialogDescription>Currently {item.quantity} in stock. Set the new quantity.</DialogDescription>
        </DialogHeader>
        <div className="flex items-center justify-center gap-4">
          <Button type="button" variant="outline" size="icon-lg" aria-label="Decrease" disabled={qty <= 0}
            onClick={() => setQty((q) => Math.max(0, q - 1))}><Minus /></Button>
          <input
            inputMode="numeric"
            aria-label="New quantity"
            className="h-14 w-24 rounded-md border text-center text-2xl font-bold"
            value={qty}
            onChange={(e) => {
              const n = parseInt(e.target.value.replace(/\D/g, ""), 10);
              setQty(Number.isFinite(n) ? Math.min(100000, n) : 0);
            }}
          />
          <Button type="button" variant="outline" size="icon-lg" aria-label="Increase" onClick={() => setQty((q) => q + 1)}><Plus /></Button>
        </div>
        <p className="text-center text-sm text-muted-foreground">
          {delta === 0 ? "No change" : delta > 0 ? `Adds ${delta} to stock` : `Removes ${-delta} from stock${needsApproval ? " (needs owner approval)" : ""}`}
        </p>
        {delta < 0 && needsApproval && (
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} placeholder="Reason (e.g. damaged, miscounted)" />
        )}
        <Button size="lg" disabled={pending || delta === 0} onClick={save}>
          {pending ? "Saving…" : delta < 0 && needsApproval ? "Request approval" : "Save quantity"}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
