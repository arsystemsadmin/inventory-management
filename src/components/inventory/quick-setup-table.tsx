"use client";

import { useEffect, useRef, useState } from "react";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SizePhotoButton } from "./photo-field";
import { emptyColor, emptyProduct, STANDARD_SIZES, type DraftColor, type DraftProduct } from "@/lib/quick-setup";
import { cn } from "@/lib/utils";
import { useT } from "@/i18n/client";

/**
 * Spreadsheet-style entry: one row per variation (product + color), a
 * quantity column per size, and the row's photo at the end. Product details
 * (name, price) are typed on a product's first row; its other rows show 〃.
 */
export function QuickSetupTable({
  draft, setDraft, businessId, storeId, issuesFor,
}: {
  draft: DraftProduct[];
  setDraft: React.Dispatch<React.SetStateAction<DraftProduct[]>>;
  businessId?: string;
  storeId: string;
  /** Problems to show under a product's rows (empty until the first save attempt). */
  issuesFor: (p: DraftProduct) => string[];
}) {
  const t = useT();
  const focusId = useRef<string | null>(null);
  const [newSize, setNewSize] = useState("");
  const [addingSize, setAddingSize] = useState(false);

  useEffect(() => {
    if (!focusId.current) return;
    document.getElementById(focusId.current)?.focus();
    focusId.current = null;
  });

  // Size columns: XS–XL plus any custom size used by any product.
  const sizes = [...STANDARD_SIZES];
  for (const p of draft) for (const s of p.sizes) if (!sizes.some((x) => x.toLowerCase() === s.toLowerCase())) sizes.push(s);

  const setProduct = (pKey: string, patch: Partial<DraftProduct>) =>
    setDraft((d) => d.map((p) => (p.key === pKey ? { ...p, ...patch, error: undefined } : p)));
  const setColor = (pKey: string, cKey: string, patch: Partial<DraftColor>) =>
    setDraft((d) => d.map((p) => (p.key === pKey
      ? { ...p, error: undefined, colors: p.colors.map((c) => (c.key === cKey ? { ...c, ...patch } : c)) } : p)));
  const setQty = (p: DraftProduct, c: DraftColor, size: string, raw: string) => {
    const v = raw.replace(/\D/g, "").slice(0, 5);
    const qty = { ...c.qty };
    if (v === "") delete qty[size]; else qty[size] = v; // empty cell = size not stocked
    const patch: Partial<DraftProduct> = {};
    if (!p.sizes.includes(size)) patch.sizes = [...p.sizes, size];
    setDraft((d) => d.map((x) => (x.key === p.key
      ? { ...x, ...patch, error: undefined, colors: x.colors.map((y) => (y.key === c.key ? { ...y, qty } : y)) } : x)));
  };
  const removeRow = (p: DraftProduct, c: DraftColor) =>
    setDraft((d) => {
      const next = d.map((x) => (x.key === p.key ? { ...x, colors: x.colors.filter((y) => y.key !== c.key) } : x))
        .filter((x) => x.colors.length > 0);
      return next.length ? next : [emptyProduct()];
    });

  /** New row under the last product: same product and quantities, empty variation name, no photo. */
  const addVariation = () => {
    const last = draft[draft.length - 1];
    if (!last) return;
    const prev = last.colors[last.colors.length - 1];
    const c = emptyColor(prev ? { ...prev.qty } : {});
    focusId.current = `tcolor-${c.key}`;
    setProduct(last.key, { colors: [...last.colors, c] });
  };
  /** New empty row = a new product. */
  const newProduct = () => {
    const p = emptyProduct();
    focusId.current = `tname-${p.key}`;
    setDraft((d) => [...d, p]);
  };
  const addSizeColumn = () => {
    const s = newSize.trim().slice(0, 40);
    setNewSize(""); setAddingSize(false);
    if (!s || sizes.some((x) => x.toLowerCase() === s.toLowerCase())) return;
    setDraft((d) => d.map((p) => ({ ...p, sizes: [...p.sizes, s] })));
  };

  // Enter moves down to the same column on the next row (like a spreadsheet).
  const rowIds = draft.flatMap((p) => p.colors.map((c) => ({ p, c })));
  const onEnter = (e: React.KeyboardEvent<HTMLInputElement>, row: number, col: string) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    const next = rowIds[row + 1];
    if (next) document.getElementById(col === "color" ? `tcolor-${next.c.key}` : `cell-${next.c.key}-${col}`)?.focus();
  };

  const cell = "h-9 rounded-md border border-input bg-background px-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/40";
  let rowIndex = -1;
  return (
    <div className="grid gap-3">
      <p className="text-xs text-muted-foreground">{t("bulk.tableHelp")}</p>
      <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <table className="w-max min-w-full border-separate border-spacing-0 text-sm">
          <thead>
            <tr className="text-xs text-muted-foreground">
              <th className="px-1 pb-1.5 text-start font-medium">{t("bulk.colProduct")}</th>
              <th className="px-1 pb-1.5 text-start font-medium">{t("bulk.colVariation")}</th>
              <th className="px-1 pb-1.5 text-start font-medium">{t("bulk.price")} ₪</th>
              {sizes.map((s) => <th key={s} className="px-0.5 pb-1.5 text-center font-semibold text-foreground">{s}</th>)}
              <th className="px-1 pb-1.5">
                {addingSize ? (
                  <input autoFocus value={newSize} onChange={(e) => setNewSize(e.target.value)} onBlur={addSizeColumn}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addSizeColumn(); } if (e.key === "Escape") setAddingSize(false); }}
                    placeholder={t("picker.otherSize")} className={cn(cell, "w-24 font-normal")} maxLength={40} />
                ) : (
                  <button type="button" onClick={() => setAddingSize(true)} aria-label={t("bulk.addSizeColumn")}
                    className="grid h-7 w-9 place-items-center rounded-md border border-dashed hover:bg-muted"><Plus className="size-3.5" /></button>
                )}
              </th>
              <th className="px-1 pb-1.5 font-medium">{t("bulk.colPhoto")}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {draft.map((p) => {
              const issues = issuesFor(p);
              return (
                <ProductRows key={p.key}>
                  {p.colors.map((c, ci) => {
                    rowIndex++;
                    const r = rowIndex;
                    const first = ci === 0;
                    const bad = issues.length > 0 || !!p.error;
                    return (
                      <tr key={c.key} className={cn(first && "[&>td]:border-t [&>td]:pt-1.5", bad && "[&>td]:bg-destructive/5")}>
                        <td className="px-1 py-0.5">
                          {first ? (
                            <input id={`tname-${p.key}`} value={p.name} onChange={(e) => setProduct(p.key, { name: e.target.value })}
                              placeholder={t("bulk.namePlaceholder")} aria-label={t("bulk.colProduct")} maxLength={200} dir="auto"
                              aria-invalid={issues.length > 0 && !p.name.trim()}
                              className={cn(cell, "w-32 font-medium", issues.length > 0 && !p.name.trim() && "border-destructive")} />
                          ) : <span className="block w-32 px-2 text-muted-foreground" title={p.name}>〃</span>}
                        </td>
                        <td className="px-1 py-0.5">
                          <input id={`tcolor-${c.key}`} value={c.color} onChange={(e) => setColor(p.key, c.key, { color: e.target.value })}
                            onKeyDown={(e) => onEnter(e, r, "color")}
                            placeholder={t("bulk.colorPlaceholder")} aria-label={t("bulk.colVariation")} maxLength={100} dir="auto"
                            className={cn(cell, "w-28")} />
                        </td>
                        <td className="px-1 py-0.5">
                          {first ? (
                            <input inputMode="decimal" value={p.price} onChange={(e) => setProduct(p.key, { price: e.target.value })}
                              placeholder="0.00" aria-label={t("form.priceLabel")}
                              className={cn(cell, "w-20 tabular-nums", issues.length > 0 && !p.price.trim() && "border-destructive")} />
                          ) : <span className="block w-20 px-2 text-muted-foreground">〃</span>}
                        </td>
                        {sizes.map((s) => (
                          <td key={s} className="px-0.5 py-0.5">
                            <input id={`cell-${c.key}-${s}`} inputMode="numeric" value={c.qty[s] ?? ""}
                              onChange={(e) => setQty(p, c, s, e.target.value)} onKeyDown={(e) => onEnter(e, r, s)}
                              onFocus={(e) => e.target.select()}
                              aria-label={t("bulk.qtyCell", { size: s, row: c.color || p.name || r + 1 })}
                              className={cn(cell, "w-11 px-0 text-center font-semibold tabular-nums", s in c.qty && "border-foreground/60")} />
                          </td>
                        ))}
                        <td />
                        <td className="px-1 py-0.5 text-center">
                          <SizePhotoButton
                            value={c.photo}
                            fallback={first ? null : p.colors[0]?.photo ?? p.photo}
                            label={c.color || p.name || t("bulk.productN", { n: r + 1 })}
                            businessId={businessId}
                            storeId={storeId}
                            onChange={(photo) => setColor(p.key, c.key, { photo })}
                            className="size-9"
                          />
                        </td>
                        <td className="px-0.5 py-0.5">
                          <button type="button" onClick={() => removeRow(p, c)} aria-label={t("bulk.removeRow")}
                            className="grid size-9 place-items-center rounded-md text-muted-foreground hover:bg-muted"><X className="size-4" /></button>
                        </td>
                      </tr>
                    );
                  })}
                  {(issues.length > 0 || p.error) && (
                    <tr>
                      <td colSpan={sizes.length + 6} className="px-1 pb-1.5 text-xs font-medium text-destructive">
                        {p.name || t("bulk.productN", { n: draft.indexOf(p) + 1 })}: {[...issues, p.error].filter(Boolean).join(" · ")}
                      </td>
                    </tr>
                  )}
                </ProductRows>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Button type="button" variant="outline" size="lg" onClick={addVariation}><Plus /> {t("bulk.addVariation")}</Button>
        <Button type="button" variant="outline" size="lg" onClick={newProduct}><Plus /> {t("bulk.newProduct")}</Button>
      </div>
    </div>
  );
}

function ProductRows({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
