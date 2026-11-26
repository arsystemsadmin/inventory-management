// Maps the stable error codes raised by our Postgres functions/triggers (and
// the browser demo) to translated, user-facing text. Anything unknown gets a
// generic message (no internals leak).
export type Translate = (key: string, options?: Record<string, unknown>) => string;

const CODES = [
  "OUT_OF_STOCK", "INVALID_QUANTITY", "ITEM_NOT_FOUND", "ITEM_ARCHIVED", "STORE_CLOSED", "NOT_STORE_MEMBER",
  "NOT_AUTHENTICATED", "OWNER_ONLY", "SALE_NOT_FOUND", "SALE_ALREADY_VOIDED", "EDIT_REQUIRES_APPROVAL",
  "STOCK_REMOVAL_REQUIRES_APPROVAL", "ARCHIVE_REQUIRES_APPROVAL", "REQUEST_ALREADY_PENDING", "ALREADY_DECIDED",
  "ALREADY_CLOCKED_IN", "NOT_CLOCKED_IN", "NO_CHANGES", "CANNOT_DEACTIVATE_OWNER", "EMAIL_TAKEN", "VARIANT_EXISTS",
  "INVALID_CREDENTIALS", "ACCOUNT_INACTIVE", "INVALID_PAYMENT", "NOT_FOUND",
] as const;

type PgLikeError = { message?: string; code?: string; details?: string | null } | null | undefined;

export function friendlyError(err: PgLikeError, tr: Translate): string {
  if (!err) return tr("errors.generic");
  const msg = err.message ?? "";
  if (msg.includes("items_variant_unique")) return tr("errors.VARIANT_EXISTS");
  for (const code of CODES) {
    if (msg.includes(code)) return tr(`errors.${code}`);
  }
  if (err.code === "23505") return tr("errors.duplicate");
  if (err.code === "42501") return tr("errors.forbidden");
  if (err.code === "23514") return tr("errors.invalidValues");
  console.error("Unmapped DB error", err);
  return tr("errors.generic");
}
