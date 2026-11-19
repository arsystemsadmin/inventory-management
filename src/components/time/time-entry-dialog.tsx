"use client";

import { useEffect, useState, useTransition } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { useActions } from "@/lib/actions-context";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { centsToInput, formatMoney, parseMoneyToCents } from "@/lib/format";
import type { ShiftWithPay } from "@/lib/time";

type Person = { id: string; full_name: string; rate_cents: number | null };

function toLocalInput(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function TimeEntryDialog({
  open, onClose, entry, people, stores,
}: {
  open: boolean; onClose: () => void; entry?: ShiftWithPay | null; people: Person[]; stores: { id: string; name: string }[];
}) {
  const [f, setF] = useState({ profile_id: "", store_id: "", clock_in: "", clock_out: "", rate: "", note: "" });
  const [pending, startTransition] = useTransition();
  const actions = useActions();

  useEffect(() => {
    if (!open) return;
    const p = people[0];
    setF(entry
      ? { profile_id: entry.profile_id, store_id: entry.store_id, clock_in: toLocalInput(entry.clock_in),
          clock_out: toLocalInput(entry.clock_out), rate: centsToInput(entry.hourly_rate_cents_snapshot), note: entry.note ?? "" }
      : { profile_id: p?.id ?? "", store_id: stores[0]?.id ?? "", clock_in: "", clock_out: "",
          rate: p?.rate_cents != null ? centsToInput(p.rate_cents) : "", note: "" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, entry?.id]);

  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const value = e.target.value;
    setF((s) => {
      const next = { ...s, [k]: value };
      if (k === "profile_id" && !entry) {
        const p = people.find((x) => x.id === value);
        if (p?.rate_cents != null) next.rate = centsToInput(p.rate_cents);
      }
      return next;
    });
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const rate = parseMoneyToCents(f.rate || "0");
    if (Number.isNaN(rate) || !f.clock_in) { toast.error("Check the times and rate"); return; }
    startTransition(async () => {
      const res = await actions.saveTimeEntry({
        id: entry?.id, profile_id: f.profile_id, store_id: f.store_id,
        clock_in: new Date(f.clock_in).toISOString(),
        clock_out: f.clock_out ? new Date(f.clock_out).toISOString() : null,
        hourly_rate_cents_snapshot: rate, note: f.note,
      });
      if (res.ok) { toast.success(res.message); onClose(); } else toast.error(res.error);
    });
  };

  const remove = () => entry && startTransition(async () => {
    const res = await actions.deleteTimeEntry(entry.id);
    if (res.ok) { toast.success(res.message); onClose(); } else toast.error(res.error);
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>{entry ? "Edit shift" : "Add shift"}</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="grid gap-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="t-person">Employee</Label>
              <NativeSelect id="t-person" value={f.profile_id} onChange={set("profile_id")} disabled={!!entry}>
                {people.map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
              </NativeSelect>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="t-store">Store</Label>
              <NativeSelect id="t-store" value={f.store_id} onChange={set("store_id")}>
                {stores.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </NativeSelect>
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="t-in">Clock in</Label>
            <Input id="t-in" type="datetime-local" value={f.clock_in} onChange={set("clock_in")} required />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="t-out">Clock out <span className="text-muted-foreground font-normal">(empty = still on shift)</span></Label>
            <Input id="t-out" type="datetime-local" value={f.clock_out} onChange={set("clock_out")} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="t-rate">Rate for this shift (₪/h)</Label>
            <Input id="t-rate" inputMode="decimal" value={f.rate} onChange={set("rate")} required />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="t-note">Note</Label>
            <Input id="t-note" value={f.note} onChange={set("note")} maxLength={500} placeholder="e.g. forgot to clock out" />
          </div>
          <Button type="submit" size="lg" disabled={pending}>{pending ? "Saving…" : "Save"}</Button>
          {entry && <Button type="button" variant="ghost" className="text-destructive" disabled={pending} onClick={remove}>Delete shift</Button>}
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function PayrollEntries({
  entries, people, stores,
}: {
  entries: ShiftWithPay[]; people: Person[]; stores: { id: string; name: string }[];
}) {
  const [editing, setEditing] = useState<ShiftWithPay | null>(null);
  const [adding, setAdding] = useState(false);
  const personName = new Map(people.map((p) => [p.id, p.full_name]));
  const storeName = new Map(stores.map((s) => [s.id, s.name]));
  const fmt = (iso: string) => new Date(iso).toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  const money = formatMoney;
  const mins = (m: number) => `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, "0")}m`;

  return (
    <section className="grid gap-2">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Shifts</h2>
        <Button variant="outline" onClick={() => setAdding(true)}><Plus /> Add shift</Button>
      </div>
      {entries.length === 0 ? <p className="text-sm text-muted-foreground">No shifts in this period.</p> : (
        <ul className="divide-y rounded-lg border bg-card text-sm">
          {entries.map((e) => (
            <li key={e.id}>
              <button type="button" onClick={() => setEditing(e)} className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-muted/50">
                <div className="min-w-0 flex-1">
                  <div className="font-medium">
                    {personName.get(e.profile_id)} <span className="font-normal text-muted-foreground">· {storeName.get(e.store_id)}</span>
                    {e.is_open && <span className="ml-2 rounded bg-amber-100 px-1.5 text-xs font-semibold text-amber-800">OPEN</span>}
                  </div>
                  <div className="text-xs text-muted-foreground" suppressHydrationWarning>
                    {fmt(e.clock_in)} – {e.clock_out ? fmt(e.clock_out) : "still clocked in"}
                    {e.note && ` · ${e.note}`}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-semibold">{money(Number(e.amount_cents))}</div>
                  <div className="text-xs text-muted-foreground">{mins(Number(e.worked_minutes))} @ {money(e.hourly_rate_cents_snapshot)}</div>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
      <TimeEntryDialog open={adding || !!editing} onClose={() => { setAdding(false); setEditing(null); }} entry={editing} people={people} stores={stores} />
    </section>
  );
}
