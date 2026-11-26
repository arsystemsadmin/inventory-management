"use client";

import { createContext, useContext } from "react";
import { addStock, createItem, createItems, removeItem, removeStock, restoreItem, saveItemEdit, saveProductEdit, sellItem } from "@/app/actions/inventory";
import { createStore, finishSetup, reopenSetup, setStoreMembers, updateStore } from "@/app/actions/stores";
import { decideApproval, requestVoid, voidSale } from "@/app/actions/sales";
import { createEmployee, setEmployeeActive, updateEmployee } from "@/app/actions/employees";
import { clockIn, clockOut, deleteTimeEntry, saveTimeEntry } from "@/app/actions/time";
import { updateMySettings } from "@/app/actions/settings";
import { safeActions } from "@/lib/safe-call";

/**
 * Default: server actions backed by Supabase. Demo mode swaps in browser
 * implementations. Every action is wrapped so it can never throw into the UI.
 */
const rawServerActions = {
  sellItem, createItem, createItems, saveItemEdit, saveProductEdit, addStock, removeStock, removeItem, restoreItem,
  createStore, updateStore, finishSetup, reopenSetup, setStoreMembers,
  voidSale, requestVoid, decideApproval,
  createEmployee, updateEmployee, setEmployeeActive,
  clockIn, clockOut, saveTimeEntry, deleteTimeEntry,
  updateMySettings,
};

export type AppActions = typeof rawServerActions;
export const serverActions: AppActions = safeActions(rawServerActions);

const ActionsContext = createContext<AppActions>(serverActions);
export const ActionsProvider = ActionsContext.Provider;
export const useActions = () => useContext(ActionsContext);
