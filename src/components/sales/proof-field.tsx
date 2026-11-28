"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Paperclip, RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { saleProofUrl, uploadSaleProof } from "@/lib/item-images";
import { cn } from "@/lib/utils";
import { useT } from "@/i18n/client";

/** Shows a private proof photo through a short-lived link. */
export function ProofImage({ path, className, alt }: { path: string; className?: string; alt: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    void saleProofUrl(path).then((u) => { if (live) setUrl(u); });
    return () => { live = false; };
  }, [path]);
  if (!url) return <span className={cn("grid place-items-center bg-muted", className)}><Loader2 className="size-4 animate-spin text-muted-foreground" /></span>;
  // eslint-disable-next-line @next/next/no-img-element -- private signed URL; no image optimizer on Workers
  return <img src={url} alt={alt} className={cn("object-cover", className)} />;
}

/**
 * Optional proof of payment (receipt, Bit / bank-transfer screenshot):
 * a dashed "add" button, or the photo with Replace / Remove.
 */
export function ProofField({
  value, onChange, businessId, storeId, disabled,
}: {
  value: string | null;
  onChange: (path: string | null) => void;
  businessId?: string;
  storeId?: string;
  disabled?: boolean;
}) {
  const t = useT();
  const input = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const pick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!businessId || !storeId) { toast.error(t("photo.pickStore")); return; }
    setUploading(true);
    const res = await uploadSaleProof(file, businessId, storeId);
    setUploading(false);
    if (res.ok) onChange(res.path); else toast.error(res.error);
  };

  return (
    <div className="grid gap-1.5">
      <input ref={input} type="file" accept="image/*" className="hidden" onChange={pick} />
      {value ? (
        <div className="flex items-center gap-3 rounded-lg border p-2">
          <ProofImage path={value} alt={t("proof.title")} className="size-14 shrink-0 rounded-md" />
          <div className="min-w-0 flex-1 text-sm font-medium">{t("proof.attached")}</div>
          <button type="button" disabled={disabled || uploading} onClick={() => input.current?.click()}
            className="inline-flex items-center gap-1 rounded-md border px-2 py-1.5 text-xs font-medium hover:bg-muted">
            {uploading ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />} {t("proof.replace")}
          </button>
          <button type="button" disabled={disabled || uploading} onClick={() => onChange(null)} aria-label={t("proof.remove")}
            className="grid size-8 place-items-center rounded-md text-muted-foreground hover:bg-muted"><Trash2 className="size-4" /></button>
        </div>
      ) : (
        <button type="button" disabled={disabled || uploading} onClick={() => input.current?.click()}
          className="flex min-h-11 items-center justify-center gap-2 rounded-lg border border-dashed px-3 text-sm text-muted-foreground hover:bg-muted">
          {uploading ? <Loader2 className="size-4 animate-spin" /> : <Paperclip className="size-4" />}
          {uploading ? t("proof.uploading") : t("proof.add")}
        </button>
      )}
    </div>
  );
}
