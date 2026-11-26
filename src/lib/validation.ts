import { z } from "zod";

// Shared by the server actions (Supabase) and the browser demo backend.

export const uuid = z.string().uuid();
export const qty = z.coerce.number().int().min(1, "validation.qtyMin").max(10000);
const optText = (max: number) =>
  z.string().trim().max(max).optional().nullable().transform((v) => (v ? v : null));
const cents = z.coerce.number().int().min(0).max(100_000_000);

export const itemFields = z.object({
  name: z.string().trim().min(1, "validation.nameRequired").max(200),
  sku: optText(64),
  category: optText(100),
  size: optText(40),
  color: optText(40),
  price_cents: cents,
  cost_cents: cents,
  low_stock_threshold: z.coerce.number().int().min(0).max(100000),
  // Storage path (database mode) or a small data URL (browser demo mode).
  image_path: z.string().max(300_000).nullable().optional().transform((v) => v || null),
  variant_image_path: z.string().max(300_000).nullable().optional().transform((v) => v || null),
  variation_image_path: z.string().max(300_000).nullable().optional().transform((v) => v || null),
});

/** Storage paths look like <business uuid>/<store uuid>/<file uuid>.jpg */
export const STORAGE_IMAGE_PATH = /^[0-9a-f-]{36}\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.(jpg|jpeg|png|webp)$/i;

export const newItemSchema = itemFields.extend({
  store_id: uuid,
  quantity: z.coerce.number().int().min(0).max(100000),
});

/** Several variants at once (e.g. one product in many sizes). */
export const newItemsSchema = z.array(newItemSchema).min(1, "validation.atLeastOneSize").max(60, "validation.tooManySizes");

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "validation.pickDate");

export const storeSchema = z
  .object({
    name: z.string().trim().min(1, "validation.nameRequired").max(200),
    type: z.enum(["popup", "permanent"]),
    address: z.string().trim().max(300).optional().transform((v) => v || null),
    starts_on: date.optional().or(z.literal("")),
    ends_on: date.optional().or(z.literal("")),
    status: z.enum(["upcoming", "active", "closed"]).optional(),
  })
  .superRefine((v, ctx) => {
    if (v.type === "popup") {
      if (!v.starts_on || !v.ends_on) ctx.addIssue({ code: "custom", message: "validation.popupDates" });
      else if (v.ends_on < v.starts_on) ctx.addIssue({ code: "custom", message: "validation.endAfterStart" });
    }
  });

/** Store form values -> row columns (status defaults from the dates). */
export function storeToRow(v: z.infer<typeof storeSchema>) {
  const popup = v.type === "popup";
  const starts_at = popup ? `${v.starts_on}T00:00:00Z` : null;
  const ends_at = popup ? `${v.ends_on}T23:59:59Z` : null;
  let status = v.status;
  if (!status) {
    const now = new Date().toISOString();
    status = !popup ? "active" : starts_at! > now ? "upcoming" : ends_at! < now ? "closed" : "active";
  }
  return { name: v.name, type: v.type, address: v.address, starts_at, ends_at, status };
}

const rateCents = z.coerce.number().int().min(0).max(100_000);

export const createEmployeeSchema = z.object({
  full_name: z.string().trim().min(1, "validation.nameRequired").max(200),
  email: z.string().trim().toLowerCase().email("validation.email"),
  password: z.string().min(8, "validation.tempPassword").max(72),
  hourly_rate_cents: rateCents,
  store_ids: z.array(uuid).max(200).default([]),
});

export const updateEmployeeSchema = z.object({
  profile_id: uuid,
  full_name: z.string().trim().min(1).max(200),
  hourly_rate_cents: rateCents,
  store_ids: z.array(uuid).max(200),
});

export const timeEntrySchema = z.object({
  id: uuid.optional(),
  profile_id: uuid,
  store_id: uuid,
  clock_in: z.string().datetime({ offset: true }),
  clock_out: z.string().datetime({ offset: true }).nullable(),
  hourly_rate_cents_snapshot: z.coerce.number().int().min(0).max(100_000),
  note: z.string().trim().max(500).optional().transform((v) => v || null),
}).refine((v) => !v.clock_out || v.clock_out > v.clock_in, { message: "validation.clockOrder" });

export const loginSchema = z.object({
  email: z.string().trim().email("validation.email"),
  password: z.string().min(1, "validation.password"),
  next: z.string().optional(),
});

export const signupSchema = z.object({
  business_name: z.string().trim().min(1, "validation.businessName").max(200),
  full_name: z.string().trim().min(1, "validation.yourName").max(200),
  email: z.string().trim().email("validation.email"),
  password: z.string().min(8, "validation.passwordLength").max(72),
});
