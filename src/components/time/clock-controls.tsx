"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { useActions } from "@/lib/actions-context";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";

export function ClockControls({ isOpen, stores }: { isOpen: boolean; stores: { id: string; name: string }[] }) {
  const [storeId, setStoreId] = useState(stores[0]?.id ?? "");
  const [pending, startTransition] = useTransition();
  const actions = useActions();
  const run = (fn: () => Promise<{ ok: boolean; error?: string; message?: string }>) =>
    startTransition(async () => {
      const res = await fn();
      if (res.ok) toast.success(res.message); else toast.error(res.error);
    });

  if (isOpen) {
    return (
      <Button size="xl" variant="destructive" className="w-full" disabled={pending} onClick={() => run(actions.clockOut)}>
        {pending ? "…" : "Clock out"}
      </Button>
    );
  }
  if (stores.length === 0) return <p className="text-sm text-muted-foreground">No open stores to clock in to.</p>;
  return (
    <div className="grid gap-3">
      {stores.length > 1 && (
        <NativeSelect value={storeId} onChange={(e) => setStoreId(e.target.value)} aria-label="Store" className="h-12">
          {stores.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </NativeSelect>
      )}
      <Button size="xl" variant="success" className="w-full" disabled={pending || !storeId} onClick={() => run(() => actions.clockIn(storeId))}>
        {pending ? "…" : `Clock in${stores.length === 1 ? ` at ${stores[0].name}` : ""}`}
      </Button>
    </div>
  );
}
