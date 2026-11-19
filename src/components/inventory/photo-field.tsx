"use client";

import { useState } from "react";
import { ImageIcon, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Label } from "@/components/ui/label";
import { itemImageUrl, uploadItemImage } from "@/lib/item-images";

/** Optional product photo: pick/take a picture, preview, change or remove. */
export function PhotoField({
  value, onChange, businessId, storeId, onUploadingChange,
}: {
  value: string | null;
  onChange: (path: string | null) => void;
  businessId?: string;
  storeId?: string;
  onUploadingChange?: (uploading: boolean) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const url = itemImageUrl(value);

  const onPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow picking the same file again
    if (!file) return;
    if (!businessId || !storeId) { toast.error("Pick a store first"); return; }
    setUploading(true); onUploadingChange?.(true);
    const res = await uploadItemImage(file, businessId, storeId);
    setUploading(false); onUploadingChange?.(false);
    if (res.ok) onChange(res.path); else toast.error(res.error);
  };

  return (
    <div className="grid gap-1.5">
      <Label>Photo <span className="font-normal text-muted-foreground">(optional)</span></Label>
      <div className="flex items-center gap-3">
        <div className="grid size-20 shrink-0 place-items-center overflow-hidden rounded-lg border bg-muted">
          {uploading ? <Loader2 className="size-5 animate-spin text-muted-foreground" />
            : url ? (
              // eslint-disable-next-line @next/next/no-img-element -- user photos; no image optimizer on Workers
              <img src={url} alt="Product photo" className="size-full object-cover" />
            ) : <ImageIcon className="size-6 text-muted-foreground" />}
        </div>
        <div className="flex flex-col items-start gap-1.5">
          <label className="inline-flex h-10 cursor-pointer items-center rounded-md border px-4 text-sm font-medium hover:bg-muted">
            {url ? "Change photo" : "Add photo"}
            <input type="file" accept="image/*" className="sr-only" onChange={onPick} disabled={uploading} />
          </label>
          {url && !uploading && (
            <button type="button" className="text-sm text-muted-foreground underline" onClick={() => onChange(null)}>Remove photo</button>
          )}
        </div>
      </div>
    </div>
  );
}

/** Compact photo button for one size: tap to add/change, small ✕ to remove. */
export function SizePhotoButton({
  value, onChange, businessId, storeId, label, className,
}: {
  value: string | null | undefined;
  onChange: (path: string | null) => void | Promise<void>;
  businessId?: string;
  storeId?: string;
  label: string;
  className?: string;
}) {
  const [uploading, setUploading] = useState(false);
  const url = itemImageUrl(value);

  const onPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!businessId || !storeId) { toast.error("Pick a store first"); return; }
    setUploading(true);
    const res = await uploadItemImage(file, businessId, storeId);
    if (res.ok) await onChange(res.path); else toast.error(res.error);
    setUploading(false);
  };

  return (
    <span className={`relative inline-block shrink-0 ${className ?? "size-10"}`}>
      <label
        className="grid size-full cursor-pointer place-items-center overflow-hidden rounded-md border bg-background hover:bg-muted"
        title={url ? `Change photo for ${label}` : `Add photo for ${label}`}
      >
        {uploading ? <Loader2 className="size-4 animate-spin text-muted-foreground" />
          : url ? (
            // eslint-disable-next-line @next/next/no-img-element -- user photos; no image optimizer on Workers
            <img src={url} alt={`${label} photo`} className="size-full object-cover" />
          ) : <ImageIcon className="size-4 text-muted-foreground" />}
        <input type="file" accept="image/*" className="sr-only" onChange={onPick} disabled={uploading}
          aria-label={url ? `Change photo for ${label}` : `Add photo for ${label}`} />
      </label>
      {url && !uploading && (
        <button
          type="button"
          aria-label={`Remove photo for ${label}`}
          onClick={() => onChange(null)}
          className="absolute -right-1.5 -top-1.5 grid size-5 place-items-center rounded-full border bg-background text-[10px] leading-none shadow-sm"
        >
          ✕
        </button>
      )}
    </span>
  );
}
