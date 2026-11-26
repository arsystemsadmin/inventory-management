// Maps the stable error codes raised by our Postgres functions/triggers (and
// the browser demo) to translated, user-facing text. Anything unknown gets a
// generic message (no internals leak).
export type Translate = (key: string, options?: Record<string, unknown>) => string;

const CODES = [
  "OUT_OF_STOCK", "INVALID_QUANTITY", "ITEM_NOT_FOUND", "ITEM_ARCHIVED", "STORE_CLOSED", "NOT_STORE_MEMBER",
  "NOT_AUTHENTICATED", "OWNER_ONLY", "SALE_NOT_FOUND", "SALE_ALREADY_VOIDED", "EDIT_REQUIRES_APPROVAL",
  "STOCK_REMOVAL_REQUIRES_APPROVAL", "ARCHIVE_REQUIRES_APPROVAL", "REQUEST_ALREADY_PENDING", "ALREADY_DECIDED",
  "ALREADY_CLOCKED_IN", "NOT_CLOCKED_IN", "NO_CHANGES", "CANNOT_DEACTIVATE_OWNER", "EMAIL_TAKEN", "VARIANT_EXISTS",
  "INVALID_CREDENTIALS", "ACCOUNT_INACTIVE", "INVALID_PAYMENT", "NOT_FOUND", "STORE_NOT_ACCESSIBLE",
] as const;

type PgLikeError = { message?: string; code?: string; details?: string | null } | null | undefined;

// The server's error log registers a sink here to capture the raw (technical)
// error behind each user-facing message. No-op in the browser.
let rawErrorSink: ((err: unknown) => void) | null = null;
export function setRawErrorSink(sink: (err: unknown) => void) {
  rawErrorSink = sink;
}

export function friendlyError(err: PgLikeError, tr: Translate): string {
  if (err) rawErrorSink?.(err);
  if (!err) return tr("errors.generic");
  const msg = err.message ?? "";
  // Duplicates: say which rule was hit, in words the user understands.
  if (msg.includes("items_variant_unique")) return tr("errors.VARIANT_EXISTS");
  if (msg.includes("items_store_sku_unique")) return tr("errors.SKU_EXISTS");
  if (msg.includes("time_entries_one_open_shift")) return tr("errors.openShiftExists");
  if (msg.includes("approval_one_pending")) return tr("errors.REQUEST_ALREADY_PENDING");
  if (msg.includes("store_members_pkey")) return tr("errors.ALREADY_ASSIGNED");
  if (msg.includes("profiles_one_owner_per_business")) return tr("errors.forbidden");
  if (msg.includes("popup_needs_dates")) return tr("validation.popupDates"); // until migration 20261126000013 runs
  if (msg.includes("store_dates_order")) return tr("validation.endAfterStart");
  for (const code of CODES) {
    if (msg.includes(code)) return tr(`errors.${code}`);
  }
  if (err.code === "23505") return tr("errors.duplicate");
  if (err.code === "42501") return tr("errors.forbidden");
  if (err.code === "23514") return tr("errors.invalidValues");
  console.error("Unmapped DB error", err);
  return tr("errors.generic");
}
