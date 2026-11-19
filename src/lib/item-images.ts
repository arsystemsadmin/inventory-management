"use client";

import { createClient } from "@/lib/supabase/client";
import { isDemoMode } from "@/lib/mode";

const BUCKET = "item-images";

/** Public URL for an item's photo (demo mode stores a small data URL instead). */
export function itemImageUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  if (path.startsWith("data:")) return path;
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${path}`;
}

/** Shrinks a photo on the phone before upload (keeps uploads fast on market data). */
async function compress(file: File, maxDim: number, quality: number): Promise<Blob> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("Could not read that image"));
      el.src = url;
    });
    const scale = Math.min(1, maxDim / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Could not process that image");
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Could not process that image"))), "image/jpeg", quality));
  } finally {
    URL.revokeObjectURL(url);
  }
}

function blobToDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new Error("Could not read that image"));
    r.readAsDataURL(blob);
  });
}

/**
 * Uploads a photo for an item in the given store and returns the value to save
 * in items.image_path: a Storage path, or in demo mode a small data URL kept
 * in browser storage.
 */
export async function uploadItemImage(
  file: File, businessId: string, storeId: string,
): Promise<{ ok: true; path: string } | { ok: false; error: string }> {
  if (!file.type.startsWith("image/")) return { ok: false, error: "Choose an image file." };
  if (file.size > 20 * 1024 * 1024) return { ok: false, error: "That image is too large (max 20 MB)." };
  try {
    if (isDemoMode) {
      // Small enough that dozens of photos fit in browser storage.
      return { ok: true, path: await blobToDataUrl(await compress(file, 360, 0.7)) };
    }
    const blob = await compress(file, 900, 0.82);
    const path = `${businessId}/${storeId}/${crypto.randomUUID()}.jpg`;
    const { error } = await createClient().storage.from(BUCKET).upload(path, blob, {
      contentType: "image/jpeg", cacheControl: "31536000", upsert: false,
    });
    if (error) return { ok: false, error: "Upload failed. Check your connection and try again." };
    return { ok: true, path };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Could not use that image." };
  }
}
