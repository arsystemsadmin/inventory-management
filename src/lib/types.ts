export type Role = "owner" | "employee";
export type StockStatus = "OUT" | "CRITICAL" | "LOW" | "OK";
export const STOCK_STATUSES: StockStatus[] = ["OUT", "CRITICAL", "LOW", "OK"];

export type Profile = {
  id: string;
  business_id: string;
  full_name: string;
  email: string;
  role: Role;
  active: boolean;
};

export type Store = {
  id: string;
  business_id: string;
  name: string;
  type: "popup" | "permanent";
  address: string | null;
  starts_at: string | null;
  ends_at: string | null;
  status: "upcoming" | "active" | "closed";
  inventory_locked_at: string | null;
  created_at: string;
};

export type Item = {
  id: string;
  business_id: string;
  store_id: string;
  name: string;
  sku: string | null;
  category: string | null;
  size: string | null;
  color: string | null;
  price_cents: number;
  cost_cents: number;
  quantity: number;
  low_stock_threshold: number;
  archived: boolean;
  image_path: string | null; // product photo
  variant_image_path: string | null; // photo for this size (shared by its colors)
  variation_image_path: string | null; // photo for this exact size + color
  updated_at: string;
  stock_status: StockStatus;
};

export type Sale = {
  id: string;
  store_id: string;
  item_id: string;
  sold_by: string;
  item_name: string;
  size: string | null;
  color: string | null;
  quantity: number;
  unit_price_cents: number;
  total_cents: number;
  created_at: string;
  voided_at: string | null;
  // Optional: sales recorded before payment methods existed count as cash.
  payment_method?: PaymentMethod;
  cash_cents?: number;
  credit_cents?: number;
};

export type PaymentMethod = "cash" | "credit" | "split";
export const PAYMENT_METHODS: PaymentMethod[] = ["cash", "credit", "split"];
/** What the seller picked; cash_cents only matters for a split. */
export type PaymentInput = { method: PaymentMethod; cash_cents?: number };

export type SellResult = {
  sale_id: string;
  item_id: string;
  item_name: string;
  size: string | null;
  color: string | null;
  quantity_sold: number;
  total_cents: number;
  payment_method?: PaymentMethod;
  cash_cents?: number;
  credit_cents?: number;
  quantity_after: number;
  status_before: StockStatus;
  status_after: StockStatus;
};

export type ActionResult<T = undefined> = { ok: true; data?: T; message?: string } | { ok: false; error: string };
