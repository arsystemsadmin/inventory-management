// Maps the stable error codes raised by our Postgres functions/triggers to
// user-facing text. Anything unknown gets a generic message (no internals leak).
const MESSAGES: Record<string, string> = {
  OUT_OF_STOCK: "Out of stock — someone may have just sold the last one.",
  INVALID_QUANTITY: "Enter a quantity of at least 1.",
  ITEM_NOT_FOUND: "That item no longer exists.",
  ITEM_ARCHIVED: "That item has been removed from inventory.",
  STORE_CLOSED: "This store is closed.",
  NOT_STORE_MEMBER: "You are not assigned to this store.",
  NOT_AUTHENTICATED: "Your session expired. Please sign in again.",
  OWNER_ONLY: "Only the owner can do that.",
  SALE_NOT_FOUND: "Sale not found.",
  SALE_ALREADY_VOIDED: "That sale was already voided.",
  EDIT_REQUIRES_APPROVAL: "Setup is finished for this store — edits need owner approval.",
  STOCK_REMOVAL_REQUIRES_APPROVAL: "Removing stock needs owner approval.",
  ARCHIVE_REQUIRES_APPROVAL: "Removing an item needs owner approval.",
  REQUEST_ALREADY_PENDING: "There is already a pending request for this.",
  ALREADY_DECIDED: "That request was already handled.",
  ALREADY_CLOCKED_IN: "You are already clocked in.",
  NOT_CLOCKED_IN: "You are not clocked in.",
  NO_CHANGES: "Nothing changed.",
  CANNOT_DEACTIVATE_OWNER: "The owner account can't be deactivated.",
};

type PgLikeError = { message?: string; code?: string; details?: string | null } | null | undefined;

export function friendlyError(err: PgLikeError, fallback = "Something went wrong. Please try again."): string {
  if (!err) return fallback;
  const msg = err.message ?? "";
  for (const key of Object.keys(MESSAGES)) {
    if (msg.includes(key)) {
      if (key === "OUT_OF_STOCK" && err.details) return `Out of stock: ${err.details.toLowerCase()}.`;
      return MESSAGES[key];
    }
  }
  if (err.code === "23505") return "That already exists (duplicate SKU or entry).";
  if (err.code === "42501") return "You don't have permission to do that.";
  if (err.code === "23514") return "Some values are not allowed. Check the form.";
  console.error("Unmapped DB error", err);
  return fallback;
}
