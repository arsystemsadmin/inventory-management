"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { useActions } from "@/lib/actions-context";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useT } from "@/i18n/client";

export function SaleRowActions({ saleId, label, isOwner, pendingRequest }: {
  saleId: string; label: string; isOwner: boolean; pendingRequest: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [pending, startTransition] = useTransition();
  const actions = useActions();
  const t = useT();
  if (!isOwner && pendingRequest) return <span className="text-xs text-amber-700">{t("sales.voidRequested")}</span>;

  const go = () => startTransition(async () => {
    const res = isOwner ? await actions.voidSale(saleId) : await actions.requestVoid(saleId, reason);
    if (res.ok) { toast.success(res.message); setOpen(false); } else toast.error(res.error);
  });

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => { setReason(""); setOpen(true); }}>
        {isOwner ? t("sales.void") : t("sales.requestVoid")}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{isOwner ? t("sales.voidTitleOwner") : t("sales.voidTitleEmployee")}</DialogTitle>
            <DialogDescription>{t("sales.voidBody", { label })}</DialogDescription>
          </DialogHeader>
          {!isOwner && (
            <Textarea value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} placeholder={t("sales.voidReasonPlaceholder")} />
          )}
          <Button size="lg" variant="destructive" disabled={pending} onClick={go}>
            {isOwner ? t("sales.voidSale") : t("sales.sendRequest")}
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
}
