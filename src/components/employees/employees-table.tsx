"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/format";
import { EmployeeDialog, type EmployeeRow } from "./employee-dialog";

export function EmployeesTable({
  employees, stores, clockedIn,
}: {
  employees: EmployeeRow[]; stores: { id: string; name: string }[]; clockedIn: Record<string, string>;
}) {
  const [editing, setEditing] = useState<EmployeeRow | null>(null);
  const [adding, setAdding] = useState(false);
  const storeName = new Map(stores.map((s) => [s.id, s.name]));

  return (
    <div className="grid gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Employees</h1>
        <Button size="lg" onClick={() => setAdding(true)}><Plus /> Add employee</Button>
      </div>
      {employees.length === 0 ? (
        <p className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">No employees yet.</p>
      ) : (
        <ul className="divide-y rounded-lg border bg-card">
          {employees.map((e) => (
            <li key={e.id}>
              <button type="button" onClick={() => setEditing(e)} className="flex w-full items-center gap-3 px-3 py-3 text-left hover:bg-muted/50">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 font-medium">
                    <span className={e.active ? "" : "line-through text-muted-foreground"}>{e.full_name}</span>
                    {!e.active && <span className="rounded bg-zinc-100 px-1.5 text-xs text-zinc-600">Inactive</span>}
                    {clockedIn[e.id] && (
                      <span className="rounded bg-emerald-100 px-1.5 text-xs text-emerald-800">On shift · {storeName.get(clockedIn[e.id])}</span>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">{e.email}</div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {e.store_ids.length ? e.store_ids.map((id) => storeName.get(id)).join(", ") : "No stores assigned"}
                  </div>
                </div>
                <div className="text-right text-sm">
                  <div className="font-semibold">{e.rate_cents != null ? `${formatMoney(e.rate_cents)}/h` : "No rate"}</div>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
      <EmployeeDialog open={adding || !!editing} onClose={() => { setAdding(false); setEditing(null); }} employee={editing} stores={stores} />
    </div>
  );
}
