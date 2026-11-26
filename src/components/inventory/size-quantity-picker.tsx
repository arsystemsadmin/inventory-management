"use client";

import { useState } from "react";
import { Minus, Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { SizePhotoButton } from "./photo-field";
import { useT } from "@/i18n/client";

export type SizeRow = { size: string; qty: string; photo?: string | null };

const SIZES = ["XS", "S", "M", "L", "XL"];
const ORDER = SIZES;
const rank = (s: string) => { const i = ORDER.indexOf(s); return i === -1 ? ORDER.length : i; };

/**
 * Tap each size to add it (nothing is pre-selected), then set a quantity for
 * each. Selected sizes stay in order XS, S, M, L, XL, then any custom sizes.
 */
export function SizeQuantityPicker({
  rows, onChange, businessId, storeId,
}: {
  rows: SizeRow[]; onChange: (rows: SizeRow[]) => void; businessId?: string; storeId?: string;
}) {
  const [custom, setCustom] = useState("");
  const t = useT();
  const selected = new Set(rows.map((r) => r.size.toLowerCase()));

  const sorted = (next: SizeRow[]) => [...next].sort((a, b) => rank(a.size) - rank(b.size));
  const toggle = (size: string) =>
    onChange(selected.has(size.toLowerCase())
      ? rows.filter((r) => r.size.toLowerCase() !== size.toLowerCase())
      : sorted([...rows, { size, qty: "1" }]));
  const addCustom = () => {
    const size = custom.trim().slice(0, 40);
    if (size && !selected.has(size.toLowerCase())) onChange(sorted([...rows, { size, qty: "1" }]));
    setCustom("");
  };
  const setQty = (size: string, qty: string) =>
    onChange(rows.map((r) => (r.size === size ? { ...r, qty: qty.replace(/\D/g, "").slice(0, 6) } : r)));
  const bump = (size: string, d: number) => {
    const r = rows.find((x) => x.size === size);
    setQty(size, String(Math.max(0, (parseInt(r?.qty || "0", 10) || 0) + d)));
  };
  const total = rows.reduce((n, r) => n + (parseInt(r.qty || "0", 10) || 0), 0);

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap gap-2">
        {SIZES.map((sz) => (
          <button
            key={sz}
            type="button"
            aria-pressed={selected.has(sz.toLowerCase())}
            onClick={() => toggle(sz)}
            className={cn(
              "min-h-11 min-w-12 rounded-lg border px-3 text-sm font-semibold transition-colors",
              selected.has(sz.toLowerCase()) ? "border-foreground bg-foreground text-background" : "bg-background hover:bg-muted",
            )}
          >
            {sz}
          </button>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCustom(); } }}
          placeholder={t("picker.otherSize")}
          maxLength={40}
          aria-label={t("picker.customSize")}
          className="h-10 min-w-0 flex-1 rounded-md border border-input bg-transparent px-3 shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
        />
        <button type="button" onClick={addCustom} className="h-10 rounded-md border px-3 text-sm font-medium hover:bg-muted">{t("common.add")}</button>
      </div>

      {rows.length > 0 && (
        <div className="rounded-lg border">
          <div className="flex items-center justify-between border-b px-3 py-2 text-xs text-muted-foreground">
            <span>{t("picker.header")}</span>
            <span>{t("picker.summary", { count: rows.length, total })}</span>
          </div>
          <ul className="divide-y">
            {rows.map((r) => (
              <li key={r.size} className="flex items-center gap-2 px-3 py-2">
                <SizePhotoButton
                  value={r.photo}
                  label={t("picker.sizeLabel", { size: r.size })}
                  businessId={businessId}
                  storeId={storeId}
                  onChange={(photo) => onChange(rows.map((x) => (x.size === r.size ? { ...x, photo } : x)))}
                />
                <span className="min-w-0 flex-1 truncate font-medium">{r.size}</span>
                <button type="button" aria-label={t("picker.fewer", { size: r.size })} onClick={() => bump(r.size, -1)}
                  className="grid size-10 place-items-center rounded-md border hover:bg-muted"><Minus className="size-4" /></button>
                <input
                  inputMode="numeric"
                  aria-label={t("picker.quantityFor", { size: r.size })}
                  value={r.qty}
                  placeholder="0"
                  onChange={(e) => setQty(r.size, e.target.value)}
                  className="h-10 w-16 rounded-md border text-center font-semibold"
                />
                <button type="button" aria-label={t("picker.more", { size: r.size })} onClick={() => bump(r.size, 1)}
                  className="grid size-10 place-items-center rounded-md border hover:bg-muted"><Plus className="size-4" /></button>
                <button type="button" aria-label={t("picker.remove", { size: r.size })} onClick={() => toggle(r.size)}
                  className="grid size-10 place-items-center rounded-md text-muted-foreground hover:bg-muted"><X className="size-4" /></button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
