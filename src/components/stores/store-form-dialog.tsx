"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useActions } from "@/lib/actions-context";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { isoToDateInput } from "@/lib/format";
import type { Store } from "@/lib/types";

export function StoreFormDialog({ open, onClose, store }: { open: boolean; onClose: () => void; store?: Store }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const actions = useActions();
  const [f, setF] = useState({ name: "", type: "popup", address: "", starts_on: "", ends_on: "", status: "" });

  useEffect(() => {
    if (!open) return;
    setF(store
      ? { name: store.name, type: store.type, address: store.address ?? "", starts_on: isoToDateInput(store.starts_at),
          ends_on: isoToDateInput(store.ends_at), status: store.status }
      : { name: "", type: "popup", address: "", starts_on: "", ends_on: "", status: "" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, store?.id]);

  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setF((s) => ({ ...s, [k]: e.target.value }));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      const payload = { ...f, status: f.status || undefined };
      const res = store ? await actions.updateStore(store.id, payload) : await actions.createStore(payload);
      if (!res.ok) { toast.error(res.error); return; }
      toast.success(res.message);
      onClose();
      if (!store && res.data) router.push(`/stores/${res.data}`);
    });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>{store ? "Edit store" : "New store"}</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="grid gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="s-name">Name</Label>
            <Input id="s-name" value={f.name} onChange={set("name")} required maxLength={200} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="s-type">Type</Label>
              <NativeSelect id="s-type" value={f.type} onChange={set("type")}>
                <option value="popup">Pop-up</option>
                <option value="permanent">Permanent</option>
              </NativeSelect>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="s-status">Status</Label>
              <NativeSelect id="s-status" value={f.status} onChange={set("status")}>
                {!store && <option value="">Auto (from dates)</option>}
                <option value="upcoming">Upcoming</option>
                <option value="active">Active</option>
                <option value="closed">Closed</option>
              </NativeSelect>
            </div>
          </div>
          {f.type === "popup" && (
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="s-start">Starts</Label>
                <Input id="s-start" type="date" value={f.starts_on} onChange={set("starts_on")} required />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="s-end">Ends</Label>
                <Input id="s-end" type="date" value={f.ends_on} onChange={set("ends_on")} required />
              </div>
            </div>
          )}
          <div className="grid gap-1.5">
            <Label htmlFor="s-address">Address / location</Label>
            <Input id="s-address" value={f.address} onChange={set("address")} maxLength={300} />
          </div>
          <Button type="submit" size="lg" disabled={pending}>{pending ? "Saving…" : "Save"}</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
