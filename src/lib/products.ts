import { STOCK_ORDER } from "@/lib/format";
import type { Item, StockStatus } from "@/lib/types";

/**
 * A product is every variation (size/color row) with the same name in the same
 * store. Each variation keeps its own stock, price and SKU; the product is how
 * they're shown, sold and edited together.
 */
export type Product = {
  key: string;
  store_id: string;
  name: string;
  category: string | null;
  image_path: string | null;
  variants: Item[];
  quantity: number;
  minPrice: number;
  maxPrice: number;
  status: StockStatus; // worst variation
};

export const productKey = (storeId: string, name: string) => `${storeId}::${name.trim().toLowerCase()}`;

const SIZE_ORDER = ["XS", "S", "M", "L", "XL"];
const sizeRank = (s: string | null) => {
  if (!s) return -1;
  const i = SIZE_ORDER.indexOf(s.toUpperCase());
  return i === -1 ? SIZE_ORDER.length : i;
};

export function sortVariants(a: Item, b: Item) {
  return sizeRank(a.size) - sizeRank(b.size)
    || (a.size ?? "").localeCompare(b.size ?? "", undefined, { numeric: true })
    || (a.color ?? "").localeCompare(b.color ?? "");
}

export function groupProducts(items: Item[]): Product[] {
  const map = new Map<string, Item[]>();
  for (const i of items) {
    const k = productKey(i.store_id, i.name);
    const list = map.get(k);
    if (list) list.push(i); else map.set(k, [i]);
  }
  return [...map.entries()].map(([key, list]) => {
    const variants = [...list].sort(sortVariants);
    const prices = variants.map((v) => v.price_cents);
    return {
      key,
      store_id: variants[0].store_id,
      name: variants[0].name,
      category: variants.find((v) => v.category)?.category ?? null,
      image_path: variants.find((v) => v.image_path)?.image_path ?? null,
      variants,
      quantity: variants.reduce((n, v) => n + v.quantity, 0),
      minPrice: Math.min(...prices),
      maxPrice: Math.max(...prices),
      status: variants.reduce<StockStatus>((w, v) => (STOCK_ORDER[v.stock_status] < STOCK_ORDER[w] ? v.stock_status : w), "OK"),
    };
  }).sort((a, b) => a.name.localeCompare(b.name));
}
