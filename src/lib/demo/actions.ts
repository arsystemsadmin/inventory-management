"use client";

import { z } from "zod";
import { friendlyError } from "@/lib/errors";
import type { AppActions } from "@/lib/actions-context";
import type { ActionResult } from "@/lib/types";
import {
  createEmployeeSchema, itemFields, newItemSchema, newItemsSchema, qty, storeSchema, storeToRow, timeEntrySchema, updateEmployeeSchema, uuid,
} from "@/lib/validation";
import * as L from "./logic";
import { commit, getState, getUserId, hashPassword } from "./store";

function run<T>(fn: () => T, message?: string): ActionResult<T> {
  try {
    const data = fn();
    return { ok: true, data, message };
  } catch (e) {
    if (e instanceof L.DemoError) {
      const err = e as L.DemoError & { code?: string };
      return { ok: false, error: friendlyError({ message: e.message, details: e.details ?? null, code: err.code }) };
    }
    console.error(e);
    return { ok: false, error: "Something went wrong. Please try again." };
  }
}
const invalid = (e: z.ZodError) => ({ ok: false as const, error: e.issues[0]?.message ?? "Invalid input" });
const me = () => L.currentUser(getState(), getUserId());

/** Same signatures as the server actions; runs the browser rules against localStorage. */
export const demoActions: AppActions = {
  async sellItem(input) {
    const p = z.object({ itemId: uuid, quantity: qty }).safeParse(input);
    if (!p.success) return invalid(p.error);
    return run(() => commit((s) => L.sellItem(s, getUserId(), p.data.itemId, p.data.quantity)));
  },
  async createItem(input) {
    const p = newItemSchema.safeParse(input);
    if (!p.success) return invalid(p.error);
    const r = run(() => commit((s) => { L.createItem(s, getUserId(), p.data); }), "Item added");
    return r.ok ? { ok: true, message: r.message } : r;
  },
  async createItems(input) {
    const p = newItemsSchema.safeParse(input);
    if (!p.success) return invalid(p.error);
    // One commit: if any variant fails (e.g. duplicate SKU) nothing is saved.
    return run(() => commit((s) => { p.data.forEach((row) => L.createItem(s, getUserId(), row)); return p.data.length; }),
      `Added ${p.data.length} item${p.data.length === 1 ? "" : "s"}`);
  },
  async saveItemEdit({ itemId, changes, reason }) {
    const p = itemFields.partial().safeParse(changes);
    if (!p.success) return invalid(p.error);
    const { image_path, variant_image_path, variation_image_path, ...rest } = p.data;
    const diff = Object.fromEntries(Object.entries(rest).filter(([, v]) => v !== undefined));
    const raw = changes as object;
    const photo: { image_path?: string | null; variant_image_path?: string | null; variation_image_path?: string | null } = {};
    if ("image_path" in raw) photo.image_path = image_path ?? null;
    if ("variant_image_path" in raw) photo.variant_image_path = variant_image_path ?? null;
    if ("variation_image_path" in raw) photo.variation_image_path = variation_image_path ?? null;
    const imageChanged = Object.keys(photo).length > 0;
    if (!Object.keys(diff).length && !imageChanged) return { ok: false, error: "Nothing changed." };
    const u = me();
    const item = getState().items.find((i) => i.id === itemId);
    if (!u || !item) return { ok: false, error: "Item not found." };
    if (imageChanged) {
      const r = run(() => commit((s) => L.setItemImage(s, u.id, itemId, photo)));
      if (!r.ok) return r;
      if (!Object.keys(diff).length) {
        return { ok: true, data: "applied" as const, message: Object.values(photo).some(Boolean) ? "Photo updated" : "Photo removed" };
      }
    }
    if (L.canEditDirectly(getState(), u, item.store_id)) {
      const r = run(() => commit((s) => L.editItem(s, u.id, itemId, diff)), "Item updated");
      return r.ok ? { ok: true, data: "applied" as const, message: r.message } : r;
    }
    const r = run(() => commit((s) => L.requestApproval(s, u.id, "edit_item", itemId, reason, diff)), "Edit sent to the owner for approval");
    return r.ok ? { ok: true, data: "requested" as const, message: r.message } : r;
  },
  async saveProductEdit({ storeId, name, changes, reason }) {
    const ids = getState().items
      .filter((i) => i.store_id === storeId && !i.archived && i.name.trim().toLowerCase() === name.trim().toLowerCase())
      .map((i) => i.id);
    if (!ids.length) return { ok: false, error: "Product not found." };
    let requested = false;
    for (const itemId of ids) {
      const res = await demoActions.saveItemEdit({ itemId, changes, reason });
      if (!res.ok) return res;
      if (res.data === "requested") requested = true;
    }
    return { ok: true, message: requested ? "Changes sent to the owner for approval" : "Product updated" };
  },
  async addStock(input) {
    const p = z.object({ itemId: uuid, quantity: qty }).safeParse(input);
    if (!p.success) return invalid(p.error);
    return run(() => commit((s) => L.addStock(s, getUserId(), p.data.itemId, p.data.quantity)), `Added ${p.data.quantity} to stock`);
  },
  async removeStock(input) {
    const p = z.object({ itemId: uuid, quantity: qty, reason: z.string().max(500).optional() }).safeParse(input);
    if (!p.success) return invalid(p.error);
    const u = me();
    const item = getState().items.find((i) => i.id === p.data.itemId);
    if (!u || !item) return { ok: false, error: "Item not found." };
    const r = L.canEditDirectly(getState(), u, item.store_id)
      ? run(() => commit((s) => L.removeStock(s, u.id, p.data.itemId, p.data.quantity)), `Removed ${p.data.quantity} from stock`)
      : run(() => commit((s) => { L.requestApproval(s, u.id, "edit_item", p.data.itemId, p.data.reason, { quantity_delta: -p.data.quantity }); }),
        "Stock removal sent to the owner for approval");
    return r.ok ? { ok: true, message: r.message } : r;
  },
  async removeItem({ itemId, reason }) {
    const u = me();
    const r = L.isOwner(u)
      ? run(() => commit((s) => L.setArchived(s, getUserId(), itemId, true)), "Item removed")
      : run(() => commit((s) => { L.requestApproval(s, getUserId(), "archive_item", itemId, reason); }), "Removal sent to the owner for approval");
    return r.ok ? { ok: true, message: r.message } : r;
  },
  async restoreItem(itemId) {
    const r = run(() => commit((s) => L.setArchived(s, getUserId(), itemId, false)), "Item restored");
    return r.ok ? { ok: true, message: r.message } : r;
  },

  async createStore(input) {
    const p = storeSchema.safeParse(input);
    if (!p.success) return invalid(p.error);
    return run(() => commit((s) => L.saveStore(s, getUserId(), storeToRow(p.data))), "Store created");
  },
  async updateStore(storeId, input) {
    const p = storeSchema.safeParse(input);
    if (!p.success) return invalid(p.error);
    const r = run(() => commit((s) => L.saveStore(s, getUserId(), storeToRow(p.data), storeId)), "Store updated");
    return r.ok ? { ok: true, message: r.message } : r;
  },
  async finishSetup(storeId) {
    const r = run(() => commit((s) => L.setSetupLocked(s, getUserId(), storeId, true)), "Setup finished. Inventory is now locked.");
    return r.ok ? { ok: true, message: r.message } : r;
  },
  async reopenSetup(storeId) {
    const r = run(() => commit((s) => L.setSetupLocked(s, getUserId(), storeId, false)), "Setup reopened. Employees can edit freely again.");
    return r.ok ? { ok: true, message: r.message } : r;
  },
  async setStoreMembers(storeId, ids) {
    const r = run(() => commit((s) => L.setStoreMembers(s, getUserId(), storeId, ids)), "Staff updated");
    return r.ok ? { ok: true, message: r.message } : r;
  },

  async voidSale(saleId) {
    const r = run(() => commit((s) => L.voidSale(s, getUserId(), saleId)), "Sale voided and stock restored");
    return r.ok ? { ok: true, message: r.message } : r;
  },
  async requestVoid(saleId, reason) {
    const r = run(() => commit((s) => { L.requestApproval(s, getUserId(), "void_sale", saleId, reason); }), "Void request sent to the owner");
    return r.ok ? { ok: true, message: r.message } : r;
  },
  async decideApproval(id, approve, note) {
    const r = run(() => commit((s) => L.decideApproval(s, getUserId(), id, approve, note)), approve ? "Approved" : "Rejected");
    return r.ok ? { ok: true, message: r.message } : r;
  },

  async createEmployee(input) {
    const p = createEmployeeSchema.safeParse(input);
    if (!p.success) return invalid(p.error);
    const password_hash = await hashPassword(p.data.password);
    const r = run(() => commit((s) => L.createEmployee(s, getUserId(), { ...p.data, password_hash })),
      `${p.data.full_name} can now sign in with ${p.data.email}`);
    return r.ok ? { ok: true, message: r.message } : r;
  },
  async updateEmployee(input) {
    const p = updateEmployeeSchema.safeParse(input);
    if (!p.success) return invalid(p.error);
    const r = run(() => commit((s) => L.updateEmployee(s, getUserId(), p.data)), "Employee updated");
    return r.ok ? { ok: true, message: r.message } : r;
  },
  async setEmployeeActive(id, active) {
    const r = run(() => commit((s) => L.setEmployeeActive(s, getUserId(), id, active)), active ? "Employee reactivated" : "Employee deactivated");
    return r.ok ? { ok: true, message: r.message } : r;
  },

  async clockIn(storeId) {
    const r = run(() => commit((s) => L.clockIn(s, getUserId(), storeId)), "Clocked in. Have a good shift!");
    return r.ok ? { ok: true, message: r.message } : r;
  },
  async clockOut() {
    const r = run(() => commit((s) => L.clockOut(s, getUserId())), "Clocked out");
    return r.ok ? { ok: true, message: r.message } : r;
  },
  async saveTimeEntry(input) {
    const p = timeEntrySchema.safeParse(input);
    if (!p.success) return invalid(p.error);
    const r = run(() => commit((s) => L.saveShift(s, getUserId(), p.data)), p.data.id ? "Shift updated" : "Shift added");
    if (!r.ok && r.error.includes("already exists")) return { ok: false, error: "This person already has an open shift. Close it first." };
    return r.ok ? { ok: true, message: r.message } : r;
  },
  async deleteTimeEntry(id) {
    const r = run(() => commit((s) => L.deleteShift(s, getUserId(), id)), "Shift deleted");
    return r.ok ? { ok: true, message: r.message } : r;
  },
};
