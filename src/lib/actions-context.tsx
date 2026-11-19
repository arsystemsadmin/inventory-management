"use client";

import { createContext, useContext } from "react";
import { addStock, createItem, removeItem, removeStock, restoreItem, saveItemEdit, sellItem } from "@/app/actions/inventory";
import { createStore, finishSetup, reopenSetup, setStoreMembers, updateStore } from "@/app/actions/stores";
import { decideApproval, requestVoid, voidSale } from "@/app/actions/sales";
import { createEmployee, setEmployeeActive, updateEmployee } from "@/app/actions/employees";
import { clockIn, clockOut, deleteTimeEntry, saveTimeEntry } from "@/app/actions/time";

/** Default: server actions backed by Supabase. Demo mode swaps in browser implementations. */
export const serverActions = {
  sellItem, createItem, saveItemEdit, addStock, removeStock, removeItem, restoreItem,
  createStore, updateStore, finishSetup, reopenSetup, setStoreMembers,
  voidSale, requestVoid, decideApproval,
  createEmployee, updateEmployee, setEmployeeActive,
  clockIn, clockOut, saveTimeEntry, deleteTimeEntry,
};

export type AppActions = typeof serverActions;

const ActionsContext = createContext<AppActions>(serverActions);
export const ActionsProvider = ActionsContext.Provider;
export const useActions = () => useContext(ActionsContext);
