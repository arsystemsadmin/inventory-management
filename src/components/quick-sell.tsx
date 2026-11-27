"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { ArrowLeft, Loader2, Minus, Plus, Search, ShoppingBag, ShoppingCart, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useT } from "@/i18n/client";
import { createClient } from "@/lib/supabase/client";
import { formatMoney, isolate, variantLabel } from "@/lib/format";
import { cartTotal, cartUnits, clearCart, onOpenCart, refreshCart, removeFromCart, setCartQty, useCart } from "@/lib/cart";
import { useActions } from "@/lib/actions-context";
import { Button } from "@/components/ui/button";
import { PaymentPicker, usePayment } from "@/components/sales/payment-picker";
import { groupProducts, type Product } from "@/lib/products";
import type { Item } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useActiveStore } from "@/lib/active-store";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { announceSale, SellDialog } from "@/components/inventory/sell-dialog";
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
 * Floating Sell button shown on every page. Pick products one by one into a
 * cart (color, size, quantity each), then pay once for everything.
 */
export function QuickSell({ load }: { load: QuickSellLoader }) {
  const t = useT();
  const actions = useActions();
  const cart = useCart();
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<"browse" | "cart">("browse");
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<QuickSellData | null>(null);
  const [storeId, setStoreId] = useState("");
  const [q, setQ] = useState("");
  const [picking, setPicking] = useState<{ item: Item; variants: Item[] } | null>(null);
  const [pending, startTransition] = useTransition();
  const { activeStoreId } = useActiveStore();
  const total = cartTotal(cart);
  const units = cartUnits(cart);
  const pay = usePayment(total);

  const openPicker = async (startOn: "browse" | "cart" = "browse") => {
    setOpen(true);
    setView(startOn);
    setQ("");
    setLoading(true);
    try {
      const d = await load();
      const openStores = d.stores.filter((s) => s.status !== "closed");
      let remembered = "";
      try { remembered = window.localStorage.getItem(STORE_KEY) ?? ""; } catch { /* ignore */ }
      setData({ ...d, stores: openStores });
      const preferred = [activeStoreId, remembered].find((id) => id && openStores.some((s) => s.id === id));
      setStoreId(preferred ?? openStores[0]?.id ?? "");
      refreshCart(d.items); // latest prices and stock for what's already in the cart
    } catch {
      toast.error(t("quickSell.loadFailed"));
      setOpen(false);
    } finally {
      setLoading(false);
    }
  };

  // "View cart" from any sell sheet's toast.
  useEffect(() => onOpenCart(() => { void openPicker("cart"); }));

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

  // Picking a product: the dialog steps aside for the variation sheet, then comes back.
  const pick = (p: Product) => {
    const first = [...p.variants].sort((a, b) => Number(b.quantity > 0) - Number(a.quantity > 0))[0];
    setOpen(false);
    setPicking({ item: first, variants: p.variants });
  };
  const donePicking = () => { setPicking(null); setOpen(true); };

  const checkout = () => {
    if (!cart.length || !pay.valid) return;
    const method = pay.method;
    startTransition(async () => {
      const res = await actions.sellCart({
        lines: cart.map((l) => ({ itemId: l.item.id, quantity: l.quantity })),
        payment: pay.input(),
      });
      if (!res.ok) { toast.error(res.error); return; }
      const r = res.data!;
      toast.success(t("cart.sold", { count: r.lines.reduce((n, l) => n + l.quantity_sold, 0) }), {
        description: `${formatMoney(r.total_cents)} · ${t(`payment.${method}`)}`,
      });
      r.lines.forEach((l) => announceSale(l, method, t, true)); // low / out warnings only
      clearCart();
      pay.reset();
      setOpen(false);
    });
  };

  return (
    <>
      <button
        type="button"
        onClick={() => openPicker(cart.length ? "cart" : "browse")}
        aria-label={cart.length ? t("cart.buttonWithCount", { count: units }) : t("quickSell.button")}
        className={cn(
          "fixed z-40 flex items-center gap-2 rounded-full bg-emerald-600 px-5 py-3.5 text-base font-semibold text-white shadow-lg",
          "end-4 bottom-[calc(5rem+env(safe-area-inset-bottom))] md:end-6 md:bottom-6",
          "hover:bg-emerald-700 active:scale-95 transition",
        )}
      >
        {cart.length ? <ShoppingCart className="size-5" /> : <ShoppingBag className="size-5" />} {t("quickSell.button")}
        {cart.length > 0 && (
          <span className="min-w-6 rounded-full bg-white px-1.5 text-center text-sm font-bold leading-6 text-emerald-700">{units}</span>
        )}
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          {view === "cart" ? (
            <>
              <DialogHeader>
                <DialogTitle>{t("cart.title")}</DialogTitle>
                <DialogDescription>{t("cart.note")}</DialogDescription>
              </DialogHeader>
              {cart.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">{t("cart.empty")}</p>
              ) : (
                <ul className="max-h-[40dvh] divide-y overflow-y-auto rounded-lg border">
                  {cart.map((l) => {
                    const v = variantLabel(l.item.size, l.item.color);
                    return (
                      <li key={l.item.id} className="grid gap-2 px-3 py-2.5">
                        <div className="flex items-start gap-3">
                          <ItemThumb path={l.item.variation_image_path ?? l.item.variant_image_path ?? l.item.image_path} alt={l.item.name} className="size-11 shrink-0" />
                          <div className="min-w-0 flex-1">
                            <bdi className="block font-medium leading-tight">{l.item.name}</bdi>
                            <span className="block text-xs text-muted-foreground">
                              {v && <><bdi>{v}</bdi> · </>}{t("sales.each", { price: formatMoney(l.item.price_cents) })}
                            </span>
                          </div>
                          <span className="shrink-0 font-semibold tabular-nums">{formatMoney(l.quantity * l.item.price_cents)}</span>
                        </div>
                        <div className="flex items-center gap-1 ps-14">
                          <Button type="button" variant="outline" size="icon" aria-label={t("common.decrease")}
                            onClick={() => setCartQty(l.item.id, l.quantity - 1)}><Minus /></Button>
                          <span className="w-8 text-center font-semibold tabular-nums">{l.quantity}</span>
                          <Button type="button" variant="outline" size="icon" aria-label={t("common.increase")}
                            disabled={l.quantity >= l.item.quantity} onClick={() => setCartQty(l.item.id, l.quantity + 1)}><Plus /></Button>
                          <Button type="button" variant="ghost" size="sm" className="ms-auto text-muted-foreground"
                            aria-label={t("cart.remove", { name: isolate(l.item.name) })} onClick={() => removeFromCart(l.item.id)}>
                            <Trash2 /> {t("cart.removeShort")}
                          </Button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
              {cart.length > 0 && (
                <>
                  <div className="flex items-baseline justify-between rounded-lg bg-muted/60 px-3 py-2">
                    <span className="text-sm">{t("cart.items", { count: units })}</span>
                    <span className="text-xl font-bold tabular-nums">{formatMoney(total)}</span>
                  </div>
                  <PaymentPicker state={pay} />
                </>
              )}
              <div className="grid gap-2">
                {cart.length > 0 && (
                  <Button size="xl" variant="success" disabled={pending || !pay.valid} onClick={checkout}>
                    {pending ? t("sell.selling") : t("cart.checkout", { total: formatMoney(total) })}
                  </Button>
                )}
                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1" onClick={() => setView("browse")}>
                    <Plus /> {t("cart.addItems")}
                  </Button>
                  {cart.length > 0 && (
                    <Button variant="ghost" className="text-destructive" onClick={() => clearCart()}>{t("cart.clear")}</Button>
                  )}
                </div>
              </div>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>{t("quickSell.title")}</DialogTitle>
                <DialogDescription>{t("cart.browseNote")}</DialogDescription>
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
                    <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("quickSell.searchPlaceholder")} className="ps-9" />
                  </div>
                  {products.length === 0 ? (
                    <p className="py-6 text-center text-sm text-muted-foreground">{t("quickSell.noProducts")}</p>
                  ) : (
                    <ul className="max-h-[45dvh] divide-y overflow-y-auto rounded-lg border">
                      {products.map((p) => {
                        const inCart = cart.filter((l) => p.variants.some((v) => v.id === l.item.id)).reduce((n, l) => n + l.quantity, 0);
                        return (
                          <li key={p.key}>
                            <button type="button" disabled={p.quantity === 0} onClick={() => pick(p)}
                              className="flex w-full items-center gap-3 px-3 py-2.5 text-start hover:bg-muted disabled:opacity-50">
                              <ItemThumb path={p.image_path} alt={p.name} className="size-11" />
                              <span className="min-w-0 flex-1">
                                <bdi className="block truncate font-medium">{p.name}</bdi>
                                <span className="block text-xs text-muted-foreground">
                                  {p.minPrice === p.maxPrice ? formatMoney(p.minPrice) : `${formatMoney(p.minPrice)}–${formatMoney(p.maxPrice)}`}
                                  {" · "}{t("sell.inStock", { count: p.quantity })}
                                </span>
                              </span>
                              {inCart > 0 && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800">
                                  <ShoppingCart className="size-3" /> {inCart}
                                </span>
                              )}
                              {p.status !== "OK" && <StockBadge status={p.status} />}
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              )}
              {cart.length > 0 && (
                <Button size="lg" variant="success" onClick={() => setView("cart")}>
                  <ShoppingCart /> {t("cart.review", { count: units, total: formatMoney(total) })}
                  <ArrowLeft className="ms-auto rtl:rotate-0 ltr:rotate-180" />
                </Button>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>

      <SellDialog item={picking?.item ?? null} variants={picking?.variants ?? []} mode="cart" onClose={donePicking} />
    </>
  );
}
