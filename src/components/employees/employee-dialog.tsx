"use client";

import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { useActions } from "@/lib/actions-context";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { centsToInput, parseMoneyToCents } from "@/lib/format";

export type EmployeeRow = {
  id: string; full_name: string; email: string; active: boolean; rate_cents: number | null; store_ids: string[];
};

export function EmployeeDialog({
  open, onClose, employee, stores,
}: {
  open: boolean; onClose: () => void; employee?: EmployeeRow | null; stores: { id: string; name: string }[];
}) {
  const [f, setF] = useState({ full_name: "", email: "", password: "", rate: "" });
  const [storeIds, setStoreIds] = useState<Set<string>>(new Set());
  const [pending, startTransition] = useTransition();
  const actions = useActions();

  useEffect(() => {
    if (!open) return;
    setF({ full_name: employee?.full_name ?? "", email: employee?.email ?? "", password: "",
      rate: employee?.rate_cents != null ? centsToInput(employee.rate_cents) : "" });
    setStoreIds(new Set(employee?.store_ids ?? []));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, employee?.id]);

  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF((s) => ({ ...s, [k]: e.target.value }));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const rate = parseMoneyToCents(f.rate || "0");
    if (Number.isNaN(rate)) { toast.error("Enter the hourly rate like 18.50"); return; }
    startTransition(async () => {
      const res = employee
        ? await actions.updateEmployee({ profile_id: employee.id, full_name: f.full_name, hourly_rate_cents: rate, store_ids: [...storeIds] })
        : await actions.createEmployee({ full_name: f.full_name, email: f.email, password: f.password, hourly_rate_cents: rate, store_ids: [...storeIds] });
      if (res.ok) { toast.success(res.message); onClose(); } else toast.error(res.error);
    });
  };

  const toggleActive = () => startTransition(async () => {
    if (!employee) return;
    const res = await actions.setEmployeeActive(employee.id, !employee.active);
    if (res.ok) { toast.success(res.message); onClose(); } else toast.error(res.error);
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{employee ? `Edit ${employee.full_name}` : "Add employee"}</DialogTitle>
          {!employee && <DialogDescription>Give them the email and temporary password to sign in.</DialogDescription>}
        </DialogHeader>
        <form onSubmit={submit} className="grid gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="e-name">Full name</Label>
            <Input id="e-name" value={f.full_name} onChange={set("full_name")} required maxLength={200} />
          </div>
          {!employee && (
            <>
              <div className="grid gap-1.5">
                <Label htmlFor="e-email">Email</Label>
                <Input id="e-email" type="email" value={f.email} onChange={set("email")} required />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="e-pass">Temporary password</Label>
                <Input id="e-pass" type="text" value={f.password} onChange={set("password")} minLength={8} required autoComplete="off" />
              </div>
            </>
          )}
          <div className="grid gap-1.5">
            <Label htmlFor="e-rate">Hourly rate ($)</Label>
            <Input id="e-rate" inputMode="decimal" value={f.rate} onChange={set("rate")} placeholder="18.00" required />
            {employee && <p className="text-xs text-muted-foreground">Applies to new shifts. Past shifts keep the rate they were worked at.</p>}
          </div>
          <div className="grid gap-1">
            <Label>Stores</Label>
            {stores.map((s) => (
              <label key={s.id} className="flex min-h-11 items-center gap-3 rounded-md px-2 hover:bg-muted">
                <Checkbox checked={storeIds.has(s.id)} onCheckedChange={(c) => setStoreIds((prev) => {
                  const n = new Set(prev); if (c) n.add(s.id); else n.delete(s.id); return n;
                })} />
                {s.name}
              </label>
            ))}
          </div>
          <Button type="submit" size="lg" disabled={pending}>{pending ? "Saving…" : employee ? "Save" : "Create employee"}</Button>
          {employee && (
            <Button type="button" variant={employee.active ? "ghost" : "outline"} className={employee.active ? "text-destructive" : ""}
              disabled={pending} onClick={toggleActive}>
              {employee.active ? "Deactivate (blocks sign-in)" : "Reactivate"}
            </Button>
          )}
        </form>
      </DialogContent>
    </Dialog>
  );
}
