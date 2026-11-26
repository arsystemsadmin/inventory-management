"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { ACTIVE_STORE_COOKIE } from "@/lib/active-store-cookie";

export type ActiveStoreOption = { id: string; name: string; status: string };
type Ctx = {
  /** "" means all stores. */
  activeStoreId: string;
  stores: ActiveStoreOption[];
  defaultStoreId: string | null;
  setActiveStore: (id: string) => void;
};

const ActiveStoreContext = createContext<Ctx>({ activeStoreId: "", stores: [], defaultStoreId: null, setActiveStore: () => {} });
export const useActiveStore = () => useContext(ActiveStoreContext);

export function readActiveStoreCookie(): string | undefined {
  if (typeof document === "undefined") return undefined;
  const m = document.cookie.match(new RegExp(`(?:^|; )${ACTIVE_STORE_COOKIE}=([^;]*)`));
  return m ? decodeURIComponent(m[1]) : undefined;
}

/** Cookie value (if still valid) > saved default store > all stores. */
export function resolveActiveStore(cookie: string | undefined, defaultStoreId: string | null | undefined, storeIds: string[]) {
  if (cookie === "all") return "";
  if (cookie && storeIds.includes(cookie)) return cookie;
  if (defaultStoreId && storeIds.includes(defaultStoreId)) return defaultStoreId;
  return storeIds.length === 1 ? storeIds[0] : "";
}

export function ActiveStoreProvider({
  stores, defaultStoreId, initialCookie, children,
}: {
  stores: ActiveStoreOption[];
  defaultStoreId: string | null;
  /** Server layouts pass the cookie; client-only (demo) layouts read it here. */
  initialCookie?: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [cookie, setCookie] = useState<string | undefined>(() => initialCookie ?? readActiveStoreCookie());
  const activeStoreId = resolveActiveStore(cookie, defaultStoreId, stores.map((s) => s.id));

  const setActiveStore = useCallback((id: string) => {
    const value = id || "all";
    document.cookie = `${ACTIVE_STORE_COOKIE}=${encodeURIComponent(value)}; path=/; max-age=31536000; samesite=lax`;
    setCookie(value);
    // Server-rendered pages (e.g. sales) read the cookie too.
    router.refresh();
  }, [router]);

  const value = useMemo(() => ({ activeStoreId, stores, defaultStoreId, setActiveStore }), [activeStoreId, stores, defaultStoreId, setActiveStore]);
  return <ActiveStoreContext.Provider value={value}>{children}</ActiveStoreContext.Provider>;
}
