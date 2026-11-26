"use client";

import { Store } from "lucide-react";
import { useActiveStore } from "@/lib/active-store";
import { useT } from "@/i18n/client";
import { cn } from "@/lib/utils";

/** Header control: which store you're working in right now. Hidden with only one store. */
export function StoreSwitcher({ className }: { className?: string }) {
  const { activeStoreId, stores, setActiveStore } = useActiveStore();
  const t = useT();
  if (stores.length < 2) return null;
  return (
    <label className={cn("relative flex items-center", className)}>
      <Store className="pointer-events-none absolute start-2 size-4 text-muted-foreground" />
      <span className="sr-only">{t("settings.activeStore")}</span>
      <select
        value={activeStoreId}
        onChange={(e) => setActiveStore(e.target.value)}
        className="h-9 max-w-[8.5rem] truncate rounded-md border bg-background ps-7 pe-2 text-sm font-medium sm:max-w-[12rem]"
      >
        <option value="">{t("common.allStores")}</option>
        {stores.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
      </select>
    </label>
  );
}
