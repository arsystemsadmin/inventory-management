"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { useActions } from "@/lib/actions-context";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

export function SaleRowActions({ saleId, label, isOwner, pendingRequest }: {
  saleId: string; label: string; isOwner: boolean; pendingRequest: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [pending, startTransition] = useTransition();
  const actions = useActions();
  if (!isOwner && pendingRequest) return <span className="text-xs text-amber-700">Void requested</span>;

  const go = () => startTransition(async () => {
    const res = isOwner ? await actions.voidSale(saleId) : await actions.requestVoid(saleId, reason);
    if (res.ok) { toast.success(res.message); setOpen(false); } else toast.error(res.error);
  });

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => { setReason(""); setOpen(true); }}>
        {isOwner ? "Void" : "Request void"}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{isOwner ? "Void this sale?" : "Ask the owner to void this sale?"}</DialogTitle>
            <DialogDescription>{label}. The quantity goes back into stock.</DialogDescription>
          </DialogHeader>
          {!isOwner && (
            <Textarea value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} placeholder="Reason (e.g. customer returned it)" />
          )}
          <Button size="lg" variant="destructive" disabled={pending} onClick={go}>
            {isOwner ? "Void sale" : "Send request"}
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
}
