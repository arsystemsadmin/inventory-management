"use client";

import { useState, useTransition } from "react";
import { Paperclip } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useActions } from "@/lib/actions-context";
import type { Sale } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useT } from "@/i18n/client";
import { ProofField, ProofImage } from "./proof-field";

/**
 * Per-sale proof of payment: a thumbnail when there is one, a faint paperclip
 * when not. Opens a sheet to view, add, replace or remove it, at any time.
 */
export function SaleProofButton({ sale, label }: { sale: Sale; label: string }) {
  const t = useT();
  const actions = useActions();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const has = !!sale.proof_path;

  const save = (path: string | null) => startTransition(async () => {
    const res = await actions.setSaleProof({ saleId: sale.id, proofPath: path });
    if (res.ok) toast.success(res.message); else toast.error(res.error);
  });

  return (
    <>
      <button type="button" onClick={() => setOpen(true)}
        aria-label={has ? t("proof.viewFor", { label }) : t("proof.addFor", { label })}
        className={cn("grid size-9 shrink-0 place-items-center overflow-hidden rounded-md border",
          has ? "border-emerald-300" : "border-dashed text-muted-foreground/60 hover:text-foreground")}>
        {has ? <ProofImage path={sale.proof_path!} alt="" className="size-full" /> : <Paperclip className="size-4" />}
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("proof.title")}</DialogTitle>
            <DialogDescription><bdi>{label}</bdi>{sale.cart_id && <> · {t("proof.wholeCart")}</>}</DialogDescription>
          </DialogHeader>
          {has && (
            <div className="overflow-hidden rounded-lg border bg-muted">
              <ProofImage path={sale.proof_path!} alt={t("proof.title")} className="max-h-[55dvh] w-full !object-contain" />
            </div>
          )}
          <ProofField value={sale.proof_path ?? null} onChange={save}
            businessId={sale.business_id} storeId={sale.store_id} disabled={pending} />
          <p className="text-xs text-muted-foreground">{t("proof.privacy")}</p>
        </DialogContent>
      </Dialog>
    </>
  );
}
