"use client";

import { useActiveStore } from "@/lib/active-store";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { useActions } from "@/lib/actions-context";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import { useT } from "@/i18n/client";

export function ClockControls({ isOpen, stores }: { isOpen: boolean; stores: { id: string; name: string }[] }) {
  const { activeStoreId } = useActiveStore();
  const [storeId, setStoreId] = useState(stores.some((s) => s.id === activeStoreId) ? activeStoreId : stores[0]?.id ?? "");
  const [pending, startTransition] = useTransition();
  const actions = useActions();
  const t = useT();
  const run = (fn: () => Promise<{ ok: boolean; error?: string; message?: string }>) =>
    startTransition(async () => {
      const res = await fn();
      if (res.ok) toast.success(res.message); else toast.error(res.error);
    });

  if (isOpen) {
    return (
      <Button size="xl" variant="destructive" className="w-full" disabled={pending} onClick={() => run(actions.clockOut)}>
        {pending ? "…" : t("time.clockOut")}
      </Button>
    );
  }
  if (stores.length === 0) return <p className="text-sm text-muted-foreground">{t("clock.noStores")}</p>;
  return (
    <div className="grid gap-3">
      {stores.length > 1 && (
        <NativeSelect value={storeId} onChange={(e) => setStoreId(e.target.value)} aria-label={t("dashboard.store")} className="h-12">
          {stores.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </NativeSelect>
      )}
      <Button size="xl" variant="success" className="w-full" disabled={pending || !storeId} onClick={() => run(() => actions.clockIn(storeId))}>
        {pending ? "…" : stores.length === 1 ? t("clock.clockInAt", { store: stores[0].name }) : t("time.clockIn")}
      </Button>
    </div>
  );
}
