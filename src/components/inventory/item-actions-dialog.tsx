"use client";

import { useEffect, useState, useTransition } from "react";
import { Minus, Pencil, Plus, Trash2, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { useActions } from "@/lib/actions-context";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { StockBadge } from "@/components/stock-badge";
import { variantLabel } from "@/lib/format";
import type { Item } from "@/lib/types";

type Mode = "menu" | "add" | "remove" | "delete";

export function ItemActionsDialog({
  item, onClose, onEdit, needsApproval, isOwner,
}: {
  item: Item | null;
  onClose: () => void;
  onEdit: (item: Item) => void;
  needsApproval: boolean;
  isOwner: boolean;
}) {
  const [mode, setMode] = useState<Mode>("menu");
  const [qty, setQty] = useState("1");
  const [reason, setReason] = useState("");
  const [pending, startTransition] = useTransition();
  const actions = useActions();

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (item) { setMode("menu"); setQty("1"); setReason(""); } }, [item?.id]);
  if (!item) return null;

  const run = (fn: () => Promise<{ ok: boolean; error?: string; message?: string }>) =>
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) { toast.error(res.error); return; }
      toast.success(res.message);
      onClose();
    });
  const n = Math.max(1, parseInt(qty, 10) || 1);
  // Removing an item always needs approval for employees; stock removal only after setup.
  const deleteNeedsApproval = !isOwner;

  return (
    <Dialog open={!!item} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{item.name}</DialogTitle>
          <DialogDescription className="flex items-center gap-2">
            {variantLabel(item.size, item.color) || "Standard"} · {item.quantity} in stock <StockBadge status={item.stock_status} />
          </DialogDescription>
        </DialogHeader>

        {mode === "menu" && (
          <div className="grid gap-2">
            {item.archived ? (
              isOwner && (
                <Button size="lg" variant="outline" onClick={() => run(() => actions.restoreItem(item.id))} disabled={pending}>
                  <Undo2 /> Restore variation
                </Button>
              )
            ) : (
              <>
                <Button size="lg" onClick={() => setMode("add")}><Plus /> Add stock</Button>
                <Button size="lg" variant="outline" onClick={() => setMode("remove")}>
                  <Minus /> Remove stock{needsApproval && " (needs approval)"}
                </Button>
                <Button size="lg" variant="outline" onClick={() => { onClose(); onEdit(item); }}>
                  <Pencil /> Edit variation{needsApproval && " (needs approval)"}
                </Button>
                <Button size="lg" variant="ghost" className="text-destructive" onClick={() => setMode("delete")}>
                  <Trash2 /> Remove variation{deleteNeedsApproval && " (needs approval)"}
                </Button>
              </>
            )}
          </div>
        )}

        {(mode === "add" || mode === "remove") && (
          <form
            className="grid gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              run(() => mode === "add"
                ? actions.addStock({ itemId: item.id, quantity: n })
                : actions.removeStock({ itemId: item.id, quantity: n, reason }));
            }}
          >
            <div className="grid gap-1.5">
              <Label htmlFor="qty">{mode === "add" ? "How many arrived?" : "How many to remove?"}</Label>
              <Input id="qty" inputMode="numeric" autoFocus value={qty} onChange={(e) => setQty(e.target.value.replace(/\D/g, ""))} />
            </div>
            {mode === "remove" && needsApproval && (
              <div className="grid gap-1.5">
                <Label htmlFor="reason">Reason</Label>
                <Textarea id="reason" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} placeholder="e.g. damaged, miscounted" />
              </div>
            )}
            <div className="flex gap-2">
              <Button type="button" variant="outline" size="lg" className="flex-1" onClick={() => setMode("menu")}>Back</Button>
              <Button type="submit" size="lg" className="flex-1" disabled={pending}>
                {mode === "add" ? `Add ${n}` : needsApproval ? "Request approval" : `Remove ${n}`}
              </Button>
            </div>
          </form>
        )}

        {mode === "delete" && (
          <form className="grid gap-3" onSubmit={(e) => { e.preventDefault(); run(() => actions.removeItem({ itemId: item.id, reason })); }}>
            <p className="text-sm text-muted-foreground">
              {deleteNeedsApproval
                ? "The owner will be asked to approve removing this variation from inventory."
                : "This variation is hidden from inventory. Its sales history is kept and you can restore it later."}
            </p>
            {deleteNeedsApproval && (
              <Textarea value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} placeholder="Reason (optional)" />
            )}
            <div className="flex gap-2">
              <Button type="button" variant="outline" size="lg" className="flex-1" onClick={() => setMode("menu")}>Back</Button>
              <Button type="submit" variant="destructive" size="lg" className="flex-1" disabled={pending}>
                {deleteNeedsApproval ? "Request removal" : "Remove variation"}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
