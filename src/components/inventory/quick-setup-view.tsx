"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ClipboardPaste, LayoutList, Loader2, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { SizePhotoButton } from "./photo-field";
import type { InventoryStore } from "./inventory-view";
import { useActions } from "@/lib/actions-context";
import { useActiveStore } from "@/lib/active-store";
import { parseMoneyToCents } from "@/lib/format";
import {
  colorPieces, colorUnits, emptyColor, emptyProduct, mergeParsed, parsePaste,
  type DraftColor, type DraftProduct,
} from "@/lib/quick-setup";
import { cn } from "@/lib/utils";
import { useT } from "@/i18n/client";

const draftKey = (storeId: string) => `binventory-setup-${storeId}`;

/**
 * Quick setup: many products at once. Cards (default) = one card per product,
 * a block per color, tap sizes and type quantities. Paste = a list from a
 * spreadsheet or note, previewed, then dropped into the cards for review.
 */
export function QuickSetupView({ stores, categories }: { stores: InventoryStore[]; categories: string[] }) {
  const t = useT();
  const actions = useActions();
  const { activeStoreId } = useActiveStore();
  const editable = stores.filter((s) => s.status !== "closed");
  const [storeId, setStoreId] = useState(editable.some((s) => s.id === activeStoreId) ? activeStoreId : editable[0]?.id ?? "");
  const store = editable.find((s) => s.id === storeId);
  const [mode, setMode] = useState<"cards" | "paste">("cards");
  const [draft, setDraft] = useState<DraftProduct[]>([emptyProduct()]);
  const [loaded, setLoaded] = useState(false);
  const [showErrors, setShowErrors] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const focusRef = useRef<string | null>(null);

  // Drafts are kept on this device per store, so leaving the page loses nothing.
  useEffect(() => {
    if (!storeId) return;
    setLoaded(false);
    try {
      const raw = window.localStorage.getItem(draftKey(storeId));
      setDraft(raw ? (JSON.parse(raw) as DraftProduct[]) : [emptyProduct()]);
    } catch { setDraft([emptyProduct()]); }
    setLoaded(true);
    setShowErrors(false);
  }, [storeId]);
  useEffect(() => {
    if (!loaded || !storeId) return;
    try { window.localStorage.setItem(draftKey(storeId), JSON.stringify(draft)); } catch { /* quota */ }
  }, [draft, loaded, storeId]);
  useEffect(() => {
    if (!focusRef.current) return;
    document.getElementById(focusRef.current)?.focus();
    focusRef.current = null;
  });

  const updateProduct = (key: string, patch: Partial<DraftProduct>) =>
    setDraft((d) => d.map((p) => (p.key === key ? { ...p, ...patch, error: undefined } : p)));
  const updateColor = (pKey: string, cKey: string, patch: Partial<DraftColor>) =>
    setDraft((d) => d.map((p) => (p.key === pKey
      ? { ...p, error: undefined, colors: p.colors.map((c) => (c.key === cKey ? { ...c, ...patch } : c)) } : p)));
  const toggleSize = (p: DraftProduct, c: DraftColor, size: string) => {
    const qty = { ...c.qty };
    if (size in qty) delete qty[size]; else qty[size] = "1";
    updateColor(p.key, c.key, { qty });
  };
  const addColor = (p: DraftProduct) => {
    // New color starts with the previous color's sizes and quantities.
    const prev = p.colors[p.colors.length - 1];
    const c = emptyColor(prev ? { ...prev.qty } : {});
    focusRef.current = `color-${c.key}`;
    updateProduct(p.key, { colors: [...p.colors, c] });
  };
  const addProduct = () => {
    const p = emptyProduct();
    focusRef.current = `name-${p.key}`;
    setDraft((d) => [...d, p]);
  };
  const addSize = (p: DraftProduct, raw: string) => {
    const size = raw.trim().slice(0, 40);
    if (!size || p.sizes.some((s) => s.toLowerCase() === size.toLowerCase())) return;
    updateProduct(p.key, { sizes: [...p.sizes, size] });
  };

  // What's wrong with a card (shown after the first save attempt).
  const problems = (p: DraftProduct) => {
    const out: string[] = [];
    if (!p.name.trim()) out.push(t("bulk.needName"));
    const price = parseMoneyToCents(p.price || "x");
    if (!p.price.trim() || Number.isNaN(price)) out.push(t("bulk.needPrice"));
    if (p.cost.trim() && Number.isNaN(parseMoneyToCents(p.cost))) out.push(t("form.priceFormat"));
    if (p.colors.length === 0) out.push(t("bulk.needColor"));
    if (p.colors.length > 1 && p.colors.some((c) => !c.color.trim())) out.push(t("bulk.needColorName"));
    if (p.colors.some((c) => colorPieces(c).length === 0)) out.push(t("bulk.needSizes"));
    if (p.colors.reduce((n, c) => n + colorPieces(c).length, 0) > 60) out.push(t("bulk.tooMany"));
    return out;
  };
  const isBlank = (p: DraftProduct) => !p.name.trim() && !p.price.trim() && p.colors.every((c) => !c.color.trim() && !colorPieces(c).length);
  const filled = draft.filter((p) => !isBlank(p));
  const totals = useMemo(() => ({
    products: filled.length,
    variations: filled.reduce((n, p) => n + p.colors.reduce((m, c) => m + colorPieces(c).length, 0), 0),
    units: filled.reduce((n, p) => n + p.colors.reduce((m, c) => m + colorUnits(c), 0), 0),
  }), [filled]);

  const saveAll = async () => {
    if (!store) return;
    setShowErrors(true);
    if (filled.length === 0) { toast.error(t("bulk.nothingToSave")); return; }
    if (filled.some((p) => problems(p).length)) { toast.error(t("form.fillRequired")); return; }
    const zero = filled.filter((p) => parseMoneyToCents(p.price) === 0);
    if (zero.length && !window.confirm(t("bulk.confirmZero", { list: zero.map((p) => p.name).join(", ") }))) return;

    setSaving(true);
    let savedProducts = 0, savedVariations = 0;
    const skipped: string[] = [];
    const remaining: DraftProduct[] = [];
    // One product per request: each is all-or-nothing, and a problem with one
    // product leaves it on screen without blocking the rest.
    for (const p of draft) {
      if (isBlank(p)) continue;
      const rows = p.colors.flatMap((c) => colorPieces(c).map(([size, q]) => ({
        store_id: store.id, name: p.name.trim(), category: p.category.trim(), color: c.color.trim(), size,
        sku: "", price_cents: parseMoneyToCents(p.price), cost_cents: p.cost.trim() ? parseMoneyToCents(p.cost) : 0,
        quantity: parseInt(q || "0", 10) || 0, low_stock_threshold: 1,
        image_path: p.photo, variant_image_path: c.photo,
      })));
      const res = await actions.createItems(rows);
      if (res.ok) {
        savedProducts++; savedVariations += res.data?.added ?? rows.length;
        skipped.push(...(res.data?.skipped ?? []).map((s) => `${p.name} ${s}`));
      } else {
        remaining.push({ ...p, error: res.error });
      }
    }
    setSaving(false);
    setShowErrors(false);
    setDraft(remaining.length ? remaining : [emptyProduct()]);
    if (savedProducts) toast.success(t("bulk.saved", { count: savedProducts, variations: savedVariations }));
    if (skipped.length) toast.warning(t("bulk.skipped", { list: skipped.join(", ") }), { duration: 10000 });
    if (remaining.length) toast.error(t("bulk.someFailed", { count: remaining.length }));
  };

  const parsed = useMemo(() => parsePaste(pasteText), [pasteText]);
  const usePasted = () => {
    const ok = parsed.filter((l) => l.name);
    if (!ok.length) { toast.error(t("bulk.pasteNothing")); return; }
    setDraft((d) => mergeParsed(d, ok));
    setPasteText("");
    setMode("cards");
    toast.success(t("bulk.pasteAdded", { count: ok.length }));
  };

  if (!editable.length) {
    return <p className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">{t("bulk.noStores")}</p>;
  }

  return (
    <div className="mx-auto grid w-full max-w-2xl gap-4 pb-24">
      <Link href="/inventory" className="inline-flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4 rtl:rotate-180" /> {t("nav.inventory")}
      </Link>
      <div>
        <h1 className="text-2xl font-semibold">{t("bulk.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("bulk.intro")}</p>
      </div>

      {editable.length > 1 && (
        <NativeSelect value={storeId} onChange={(e) => setStoreId(e.target.value)} aria-label={t("dashboard.store")}>
          {editable.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </NativeSelect>
      )}

      <div role="tablist" className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1">
        {(["cards", "paste"] as const).map((m) => (
          <button key={m} type="button" role="tab" aria-selected={mode === m} onClick={() => setMode(m)}
            className={cn("flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium",
              mode === m ? "bg-background shadow-sm" : "text-muted-foreground")}>
            {m === "cards" ? <LayoutList className="size-4" /> : <ClipboardPaste className="size-4" />}
            {m === "cards" ? t("bulk.cardsTab") : t("bulk.pasteTab")}
          </button>
        ))}
      </div>

      {mode === "paste" ? (
        <div className="grid gap-3">
          <p className="text-sm text-muted-foreground">{t("bulk.pasteHelp")}</p>
          <pre dir="ltr" className="overflow-x-auto rounded-md bg-muted px-3 py-2 text-xs">{"Polly, White, 120, S1 M2 L1\nPolly, Black, 120, S2 M3\nBeanie, Grey, 45, 10"}</pre>
          <textarea
            dir="auto"
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
            placeholder={t("bulk.pastePlaceholder")}
            className="min-h-40 w-full rounded-lg border bg-background p-3 font-mono text-sm leading-relaxed"
          />
          {parsed.length > 0 && (
            <>
              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full text-sm">
                  <thead className="bg-muted text-xs text-muted-foreground">
                    <tr>
                      <th className="p-2 text-start font-medium">{t("bulk.colProduct")}</th>
                      <th className="p-2 text-start font-medium">{t("fields.color")}</th>
                      <th className="p-2 text-start font-medium">₪</th>
                      <th className="p-2 text-start font-medium">{t("product.sizes")}</th>
                      <th className="p-2" />
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {parsed.map((l) => (
                      <tr key={l.line}>
                        <td className="p-2"><bdi>{l.name || "—"}</bdi></td>
                        <td className="p-2"><bdi>{l.color || "—"}</bdi></td>
                        <td className="p-2 tabular-nums">{l.price || "—"}</td>
                        <td className="p-2 text-xs">{l.sizes.map((s) => `${s.size} ${s.qty}`).join(" · ") || "—"}</td>
                        <td className="p-2 text-xs font-semibold">
                          {l.warnings.length === 0
                            ? <span className="text-emerald-700">✓</span>
                            : <span className="text-amber-700">{l.warnings.map((w) => t(`bulk.warn_${w}`)).join(", ")}</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-muted-foreground">{t("bulk.pasteReview")}</p>
              <Button size="lg" onClick={usePasted}><LayoutList /> {t("bulk.pasteToCards", { count: parsed.filter((l) => l.name).length })}</Button>
            </>
          )}
        </div>
      ) : (
        <>
          <datalist id="setup-categories">{categories.map((c) => <option key={c} value={c} />)}</datalist>
          <ul className="grid gap-3">
            {draft.map((p, pi) => {
              const issues = showErrors && !isBlank(p) ? problems(p) : [];
              return (
                <li key={p.key} className={cn("rounded-xl border bg-card p-3", (issues.length || p.error) && "border-destructive/60")}>
                  <div className="flex items-start gap-2">
                    <SizePhotoButton
                      value={p.photo}
                      label={p.name || t("bulk.productN", { n: pi + 1 })}
                      businessId={store?.business_id}
                      storeId={storeId}
                      onChange={(photo) => updateProduct(p.key, { photo })}
                      className="size-10"
                    />
                    <div className="grid min-w-0 flex-1 gap-2">
                      <div className="flex gap-2">
                        <Input id={`name-${p.key}`} value={p.name} onChange={(e) => updateProduct(p.key, { name: e.target.value })}
                          placeholder={t("bulk.namePlaceholder")} aria-label={t("bulk.colProduct")} maxLength={200}
                          aria-invalid={showErrors && !p.name.trim()} className="min-w-0 flex-1 font-medium" />
                        <Button type="button" variant="ghost" size="icon" aria-label={t("bulk.removeProduct", { name: p.name || pi + 1 })}
                          onClick={() => setDraft((d) => (d.length > 1 ? d.filter((x) => x.key !== p.key) : [emptyProduct()]))}>
                          <Trash2 className="text-muted-foreground" />
                        </Button>
                      </div>
                    </div>
                  </div>
                  <div className="mt-2 grid grid-cols-3 gap-2">
                        <Input inputMode="decimal" value={p.price} onChange={(e) => updateProduct(p.key, { price: e.target.value })}
                          placeholder={`₪ ${t("bulk.price")}`} aria-label={t("form.priceLabel")} aria-invalid={showErrors && !p.price.trim()} />
                        <Input inputMode="decimal" value={p.cost} onChange={(e) => updateProduct(p.key, { cost: e.target.value })}
                          placeholder={t("bulk.cost")} aria-label={t("form.costLabel")} />
                        <Input list="setup-categories" value={p.category} onChange={(e) => updateProduct(p.key, { category: e.target.value })}
                          placeholder={t("fields.category")} aria-label={t("fields.category")} maxLength={100} />
                  </div>

                  <div className="mt-2 grid gap-2">
                    {p.colors.map((c) => (
                      <div key={c.key} className="rounded-lg bg-muted/50 p-2">
                        <div className="flex items-center gap-2">
                          <SizePhotoButton
                            value={c.photo}
                            fallback={p.photo}
                            label={c.color || t("common.noColor")}
                            businessId={store?.business_id}
                            storeId={storeId}
                            onChange={(photo) => updateColor(p.key, c.key, { photo })}
                            className="size-10"
                          />
                          <Input id={`color-${c.key}`} value={c.color} onChange={(e) => updateColor(p.key, c.key, { color: e.target.value })}
                            placeholder={t("bulk.colorPlaceholder")} aria-label={t("fields.color")} maxLength={100} dir="auto"
                            className="h-10 min-w-0 flex-1 bg-background font-medium" />
                          <span className="shrink-0 text-xs text-muted-foreground">{t("bulk.pcs", { count: colorUnits(c) })}</span>
                          <Button type="button" variant="ghost" size="icon" aria-label={t("bulk.removeColor", { color: c.color || "—" })}
                            onClick={() => updateProduct(p.key, { colors: p.colors.filter((x) => x.key !== c.key) })}>
                            <X className="text-muted-foreground" />
                          </Button>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {p.sizes.map((size) => {
                            const on = size in c.qty;
                            return (
                              <div key={size} className={cn("flex w-14 flex-col overflow-hidden rounded-lg border",
                                on ? "border-foreground" : "bg-background")}>
                                <button type="button" aria-pressed={on} onClick={() => toggleSize(p, c, size)}
                                  className={cn("truncate px-1 py-1.5 text-xs font-bold", on ? "bg-foreground text-background" : "hover:bg-muted")}>
                                  {size}
                                </button>
                                {on && (
                                  <input inputMode="numeric" value={c.qty[size]} placeholder="0"
                                    aria-label={t("picker.quantityFor", { size })}
                                    onFocus={(e) => e.target.select()}
                                    onChange={(e) => updateColor(p.key, c.key, { qty: { ...c.qty, [size]: e.target.value.replace(/\D/g, "").slice(0, 5) } })}
                                    className="h-8 w-full bg-background text-center text-sm font-semibold outline-none" />
                                )}
                              </div>
                            );
                          })}
                          <AddSize onAdd={(s) => addSize(p, s)} />
                        </div>
                      </div>
                    ))}
                    <Button type="button" variant="outline" size="sm" className="w-fit" onClick={() => addColor(p)}>
                      <Plus /> {p.colors.length ? t("bulk.addColorCopy") : t("product.addColor")}
                    </Button>
                  </div>

                  {(issues.length > 0 || p.error) && (
                    <p role="alert" className="mt-2 text-xs font-medium text-destructive">{[...issues, p.error].filter(Boolean).join(" · ")}</p>
                  )}
                </li>
              );
            })}
          </ul>
          <Button variant="outline" size="lg" onClick={addProduct}><Plus /> {t("bulk.addProduct")}</Button>
        </>
      )}

      {/* Save bar: pinned above the phone tab bar, compact so it hides as little as possible. */}
      <div className="sticky bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-30 -mx-4 border-t bg-background/95 px-4 py-2 backdrop-blur md:bottom-0 md:mx-0 md:rounded-xl md:border">
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1 text-xs text-muted-foreground">
            <div className="font-medium text-foreground">
              {t("bulk.summaryProducts", { count: totals.products })} · {t("bulk.summaryVariations", { count: totals.variations })}
            </div>
            <div className="truncate">{t("bulk.pcs", { count: totals.units })} · {t("bulk.draftShort")}</div>
          </div>
          <Button size="lg" variant="success" className="shrink-0" disabled={saving || totals.variations === 0} onClick={saveAll}>
            {saving ? <Loader2 className="animate-spin" /> : null} {saving ? t("common.saving") : t("bulk.save")}
          </Button>
        </div>
      </div>
    </div>
  );
}

/** "+" chip that turns into a small box for a custom size (e.g. 38, One size). */
function AddSize({ onAdd }: { onAdd: (size: string) => void }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [v, setV] = useState("");
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} aria-label={t("picker.customSize")}
        className="grid h-[2.1rem] w-14 place-items-center rounded-lg border border-dashed text-muted-foreground hover:bg-muted">
        <Plus className="size-4" />
      </button>
    );
  }
  const done = () => { onAdd(v); setV(""); setOpen(false); };
  return (
    <input autoFocus value={v} onChange={(e) => setV(e.target.value)} onBlur={done}
      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); done(); } if (e.key === "Escape") setOpen(false); }}
      placeholder={t("picker.otherSize")} maxLength={40}
      className="h-[2.1rem] w-28 rounded-lg border bg-background px-2 text-sm" />
  );
}

