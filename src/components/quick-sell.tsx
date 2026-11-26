"use client";

import { useMemo, useState } from "react";
import { Loader2, Search, ShoppingBag } from "lucide-react";
import { toast } from "sonner";
import { useT } from "@/i18n/client";
import { createClient } from "@/lib/supabase/client";
import { formatMoney } from "@/lib/format";
import { groupProducts, type Product } from "@/lib/products";
import type { Item } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { SellDialog } from "@/components/inventory/sell-dialog";
import { ItemThumb } from "@/components/inventory/item-thumb";
import { StockBadge } from "@/components/stock-badge";

export type QuickSellStore = { id: string; name: string; status: string };
export type QuickSellData = { items: Item[]; stores: QuickSellStore[] };
export type QuickSellLoader = () => Promise<QuickSellData>;

/** Database mode: what the signed-in user can see (RLS-scoped), loaded fresh when opened. */
export const loadFromDatabase: QuickSellLoader = async () => {
  const supabase = createClient();
  const [items, stores] = await Promise.all([
    supabase.from("items_with_status").select("*").eq("archived", false),
    supabase.from("stores").select("id, name, status").order("name"),
  ]);
  if (items.error || stores.error) throw items.error ?? stores.error;
  return { items: (items.data ?? []) as Item[], stores: (stores.data ?? []) as QuickSellStore[] };
};

const STORE_KEY = "binventory-quick-sell-store";

/**
 * Floating Sell button shown on every page: pick a store and a product, then
 * the regular sell sheet (size, color, quantity, payment) opens.
 */
export function QuickSell({ load }: { load: QuickSellLoader }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<QuickSellData | null>(null);
  const [storeId, setStoreId] = useState("");
  const [q, setQ] = useState("");
  const [selling, setSelling] = useState<{ item: Item; variants: Item[] } | null>(null);

  const openPicker = async () => {
    setOpen(true);
    setQ("");
    setLoading(true);
    try {
      const d = await load();
      const openStores = d.stores.filter((s) => s.status !== "closed");
      let remembered = "";
      try { remembered = window.localStorage.getItem(STORE_KEY) ?? ""; } catch { /* ignore */ }
      setData({ ...d, stores: openStores });
      setStoreId(openStores.some((s) => s.id === remembered) ? remembered : openStores[0]?.id ?? "");
    } catch {
      toast.error(t("quickSell.loadFailed"));
      setOpen(false);
    } finally {
      setLoading(false);
    }
  };

  const chooseStore = (id: string) => {
    setStoreId(id);
    try { window.localStorage.setItem(STORE_KEY, id); } catch { /* ignore */ }
  };

  const products = useMemo(() => {
    if (!data || !storeId) return [] as Product[];
    const needle = q.trim().toLowerCase();
    return groupProducts(data.items.filter((i) => i.store_id === storeId))
      .filter((p) => !needle || p.name.toLowerCase().includes(needle) || (p.category ?? "").toLowerCase().includes(needle)
        || p.variants.some((v) => [v.sku, v.size, v.color].some((x) => x?.toLowerCase().includes(needle))))
      .sort((a, b) => Number(b.quantity > 0) - Number(a.quantity > 0) || a.name.localeCompare(b.name));
  }, [data, storeId, q]);

  const pick = (p: Product) => {
    const first = [...p.variants].sort((a, b) => Number(b.quantity > 0) - Number(a.quantity > 0))[0];
    setOpen(false);
    setSelling({ item: first, variants: p.variants });
  };

  return (
    <>
      <button
        type="button"
        onClick={openPicker}
        aria-label={t("quickSell.button")}
        className={cn(
          "fixed z-40 flex items-center gap-2 rounded-full bg-emerald-600 px-5 py-3.5 text-base font-semibold text-white shadow-lg",
          "end-4 bottom-[calc(5rem+env(safe-area-inset-bottom))] md:end-6 md:bottom-6",
          "hover:bg-emerald-700 active:scale-95 transition",
        )}
      >
        <ShoppingBag className="size-5" /> {t("quickSell.button")}
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("quickSell.title")}</DialogTitle>
            <DialogDescription>{t("quickSell.note")}</DialogDescription>
          </DialogHeader>
          {loading || !data ? (
            <div className="grid place-items-center py-10"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div>
          ) : data.stores.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">{t("quickSell.noStores")}</p>
          ) : (
            <div className="grid gap-3">
              {data.stores.length > 1 && (
                <NativeSelect value={storeId} onChange={(e) => chooseStore(e.target.value)} aria-label={t("dashboard.store")}>
                  {data.stores.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </NativeSelect>
              )}
              <div className="relative">
                <Search className="absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("quickSell.searchPlaceholder")} className="ps-9" autoFocus />
              </div>
              {products.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">{t("quickSell.noProducts")}</p>
              ) : (
                <ul className="max-h-[50dvh] divide-y overflow-y-auto rounded-lg border">
                  {products.map((p) => (
                    <li key={p.key}>
                      <button
                        type="button"
                        disabled={p.quantity === 0}
                        onClick={() => pick(p)}
                        className="flex w-full items-center gap-3 px-3 py-2.5 text-start hover:bg-muted disabled:opacity-50"
                      >
                        <ItemThumb path={p.image_path} alt={p.name} className="size-11" />
                        <span className="min-w-0 flex-1">
                          <bdi className="block truncate font-medium">{p.name}</bdi>
                          <span className="block text-xs text-muted-foreground">
                            {p.minPrice === p.maxPrice ? formatMoney(p.minPrice) : `${formatMoney(p.minPrice)}–${formatMoney(p.maxPrice)}`}
                            {" · "}{t("sell.inStock", { count: p.quantity })}
                          </span>
                        </span>
                        {p.status !== "OK" && <StockBadge status={p.status} />}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <SellDialog item={selling?.item ?? null} variants={selling?.variants ?? []} onClose={() => setSelling(null)} />
    </>
  );
}

