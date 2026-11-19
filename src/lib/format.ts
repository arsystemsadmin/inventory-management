import type { StockStatus } from "./types";

// Israeli shekels. Amounts are stored as integer agorot (1/100 shekel).
const money = new Intl.NumberFormat("en-IL", { style: "currency", currency: "ILS", currencyDisplay: "narrowSymbol" });

export function formatMoney(cents: number | null | undefined) {
  return money.format((cents ?? 0) / 100);
}

/** "12.50" / "₪12.50" -> 1250 agorot. Returns NaN for junk. */
export function parseMoneyToCents(input: string): number {
  const cleaned = input.replace(/[₪$,\s]/g, "");
  if (!/^\d+(\.\d{0,2})?$/.test(cleaned)) return NaN;
  const [whole, frac = ""] = cleaned.split(".");
  return Number(whole) * 100 + Number(frac.padEnd(2, "0"));
}

export function centsToInput(cents: number) {
  return (cents / 100).toFixed(2);
}

export function formatMinutes(min: number) {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return `${h}h ${m.toString().padStart(2, "0")}m`;
}

export function formatDateTime(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export function formatDate(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function variantLabel(size?: string | null, color?: string | null) {
  return [size, color].filter(Boolean).join(" · ");
}

export const STOCK_ORDER: Record<StockStatus, number> = { OUT: 0, CRITICAL: 1, LOW: 2, OK: 3 };

export function stockStatus(qty: number, threshold: number): StockStatus {
  if (qty <= 0) return "OUT";
  if (qty <= threshold / 2) return "CRITICAL";
  if (qty <= threshold) return "LOW";
  return "OK";
}

/** Store dates are calendar days stored at UTC midnight; show them without TZ shift. */
export function formatStoreDate(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}
export function isoToDateInput(iso: string | null | undefined) {
  return iso ? iso.slice(0, 10) : "";
}
