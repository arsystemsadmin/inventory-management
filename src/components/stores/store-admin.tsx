"use client";

import { useState, useTransition } from "react";
import { Lock, LockOpen, Pencil, Users } from "lucide-react";
import { toast } from "sonner";
import { finishSetup, reopenSetup, setStoreMembers } from "@/app/actions/stores";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { StoreFormDialog } from "./store-form-dialog";
import type { Store } from "@/lib/types";

export function SetupBanner({ store, isOwner, itemCount }: { store: Store; isOwner: boolean; itemCount: number }) {
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const locked = !!store.inventory_locked_at;
  const run = (fn: () => Promise<{ ok: boolean; error?: string; message?: string }>) =>
    startTransition(async () => {
      const res = await fn();
      if (res.ok) { toast.success(res.message); setConfirming(false); } else toast.error(res.error);
    });

  if (locked) {
    return isOwner ? (
      <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-muted/40 px-3 py-2 text-sm">
        <Lock className="size-4" />
        <span className="flex-1">Inventory locked. Employees can sell and add stock; edits and removals need your approval.</span>
        <Button size="sm" variant="outline" disabled={pending} onClick={() => run(() => reopenSetup(store.id))}>
          <LockOpen /> Reopen setup
        </Button>
      </div>
    ) : null;
  }
  return (
    <div className="grid gap-2 rounded-lg border border-violet-200 bg-violet-50 px-3 py-3 text-sm text-violet-900 sm:flex sm:items-center">
      <div className="flex-1">
        <b>Setup mode.</b> Add every item for this store (one per size/color) and fix anything that&apos;s wrong.
        When you&apos;re done, finish setup. After that, changes and stock removals need owner approval.
      </div>
      <Button size="lg" className="bg-violet-700 hover:bg-violet-800" disabled={itemCount === 0} onClick={() => setConfirming(true)}>
        <Lock /> Finish setup
      </Button>
      <Dialog open={confirming} onOpenChange={setConfirming}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Finish setup?</DialogTitle>
            <DialogDescription>
              {itemCount} item{itemCount === 1 ? "" : "s"} will be locked in. You can still sell and add new stock, but
              editing details or removing stock will need owner approval.
            </DialogDescription>
          </DialogHeader>
          <Button size="lg" disabled={pending} onClick={() => run(() => finishSetup(store.id))}>Yes, finish setup</Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function StoreOwnerActions({
  store, employees, memberIds,
}: {
  store: Store;
  employees: { id: string; full_name: string; active: boolean }[];
  memberIds: string[];
}) {
  const [editOpen, setEditOpen] = useState(false);
  const [staffOpen, setStaffOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set(memberIds));
  const [pending, startTransition] = useTransition();

  const save = () =>
    startTransition(async () => {
      const res = await setStoreMembers(store.id, [...selected]);
      if (res.ok) { toast.success(res.message); setStaffOpen(false); } else toast.error(res.error);
    });

  return (
    <div className="flex gap-2">
      <Button variant="outline" onClick={() => setEditOpen(true)}><Pencil /> Edit</Button>
      <Button variant="outline" onClick={() => { setSelected(new Set(memberIds)); setStaffOpen(true); }}>
        <Users /> Staff ({memberIds.length})
      </Button>
      <StoreFormDialog open={editOpen} onClose={() => setEditOpen(false)} store={store} />
      <Dialog open={staffOpen} onOpenChange={setStaffOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Staff for {store.name}</DialogTitle>
            <DialogDescription>Assigned employees can see and sell this store&apos;s inventory.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-1">
            {employees.length === 0 && <p className="text-sm text-muted-foreground">No employees yet.</p>}
            {employees.map((e) => (
              <label key={e.id} className="flex min-h-11 items-center gap-3 rounded-md px-2 hover:bg-muted">
                <Checkbox
                  checked={selected.has(e.id)}
                  onCheckedChange={(c) => setSelected((s) => {
                    const n = new Set(s);
                    if (c) n.add(e.id); else n.delete(e.id);
                    return n;
                  })}
                />
                <span className={e.active ? "" : "text-muted-foreground line-through"}>{e.full_name}</span>
              </label>
            ))}
          </div>
          <Button size="lg" disabled={pending} onClick={save}>Save</Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
