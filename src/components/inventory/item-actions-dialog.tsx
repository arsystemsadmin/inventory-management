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
import { useT } from "@/i18n/client";

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
  const t = useT();

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
            {variantLabel(item.size, item.color) || t("common.standard")} · {t("sell.inStock", { count: item.quantity })} <StockBadge status={item.stock_status} />
          </DialogDescription>
        </DialogHeader>

        {mode === "menu" && (
          <div className="grid gap-2">
            {item.archived ? (
              isOwner && (
                <Button size="lg" variant="outline" onClick={() => run(() => actions.restoreItem(item.id))} disabled={pending}>
                  <Undo2 /> {t("actions.restoreVariation")}
                </Button>
              )
            ) : (
              <>
                <Button size="lg" onClick={() => setMode("add")}><Plus /> {t("actions.addStock")}</Button>
                <Button size="lg" variant="outline" onClick={() => setMode("remove")}>
                  <Minus /> {t("actions.removeStock")}{needsApproval && ` ${t("actions.needsApproval")}`}
                </Button>
                <Button size="lg" variant="outline" onClick={() => { onClose(); onEdit(item); }}>
                  <Pencil /> {t("actions.editVariation")}{needsApproval && ` ${t("actions.needsApproval")}`}
                </Button>
                <Button size="lg" variant="ghost" className="text-destructive" onClick={() => setMode("delete")}>
                  <Trash2 /> {t("actions.removeVariation")}{deleteNeedsApproval && ` ${t("actions.needsApproval")}`}
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
              <Label htmlFor="qty">{mode === "add" ? t("actions.howManyArrived") : t("actions.howManyRemove")}</Label>
              <Input id="qty" inputMode="numeric" autoFocus value={qty} onChange={(e) => setQty(e.target.value.replace(/\D/g, ""))} />
            </div>
            {mode === "remove" && needsApproval && (
              <div className="grid gap-1.5">
                <Label htmlFor="reason">{t("common.reason")}</Label>
                <Textarea id="reason" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} placeholder={t("actions.reasonPlaceholder")} />
              </div>
            )}
            <div className="flex gap-2">
              <Button type="button" variant="outline" size="lg" className="flex-1" onClick={() => setMode("menu")}>{t("common.back")}</Button>
              <Button type="submit" size="lg" className="flex-1" disabled={pending}>
                {mode === "add" ? t("actions.addN", { count: n }) : needsApproval ? t("common.requestApproval") : t("actions.removeN", { count: n })}
              </Button>
            </div>
          </form>
        )}

        {mode === "delete" && (
          <form className="grid gap-3" onSubmit={(e) => { e.preventDefault(); run(() => actions.removeItem({ itemId: item.id, reason })); }}>
            <p className="text-sm text-muted-foreground">
              {deleteNeedsApproval
                ? t("actions.removeExplainEmployee")
                : t("actions.removeExplainOwner")}
            </p>
            {deleteNeedsApproval && (
              <Textarea value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} placeholder={t("common.reasonOptional")} />
            )}
            <div className="flex gap-2">
              <Button type="button" variant="outline" size="lg" className="flex-1" onClick={() => setMode("menu")}>{t("common.back")}</Button>
              <Button type="submit" variant="destructive" size="lg" className="flex-1" disabled={pending}>
                {deleteNeedsApproval ? t("actions.requestRemoval") : t("actions.removeVariation")}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
