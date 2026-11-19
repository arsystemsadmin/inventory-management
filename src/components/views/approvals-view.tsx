import { LocalTime } from "@/components/local-time";
import { ApprovalActions } from "@/components/sales/approval-actions";
import { formatMoney, variantLabel } from "@/lib/format";

export type ApprovalReq = {
  id: string; kind: "archive_item" | "void_sale" | "edit_item"; status: "pending" | "approved" | "rejected";
  item_id: string | null; sale_id: string | null; store_id: string; reason: string | null;
  changes: Record<string, string | number | null> | null; requested_by: string; requested_at: string;
  decided_at: string | null; decision_note: string | null;
};
type ItemLite = { id: string; name: string; size: string | null; color: string | null; quantity: number } & Record<string, unknown>;
type SaleLite = { id: string; item_name: string; size: string | null; color: string | null; quantity: number; total_cents: number };

const FIELD_LABELS: Record<string, string> = {
  name: "Name", sku: "SKU", category: "Category", size: "Size", color: "Color",
  price_cents: "Price", cost_cents: "Cost", low_stock_threshold: "Low-stock alert", quantity_delta: "Remove stock",
};

function fmtField(k: string, v: unknown) {
  if (v === null || v === undefined || v === "") return "—";
  if (k.endsWith("_cents")) return formatMoney(Number(v));
  if (k === "quantity_delta") return `${-Number(v)} units`;
  return String(v);
}

export function ApprovalsView({
  reqs, items, sales, storeNames, peopleNames, isOwner,
}: {
  reqs: ApprovalReq[]; items: ItemLite[]; sales: SaleLite[]; storeNames: Record<string, string>;
  peopleNames: Record<string, string>; isOwner: boolean;
}) {
  const itemById = new Map(items.map((i) => [i.id, i]));
  const saleById = new Map(sales.map((s) => [s.id, s]));
  const sorted = [...reqs].sort((a, b) => b.requested_at.localeCompare(a.requested_at));
  const pending = sorted.filter((r) => r.status === "pending");
  const done = sorted.filter((r) => r.status !== "pending");

  const describe = (r: ApprovalReq) => {
    if (r.kind === "void_sale") {
      const s = saleById.get(r.sale_id!);
      return s ? `Void sale: ${s.quantity} × ${s.item_name}${variantLabel(s.size, s.color) ? ` (${variantLabel(s.size, s.color)})` : ""} · ${formatMoney(s.total_cents)}` : "Void sale";
    }
    const i = itemById.get(r.item_id!);
    const name = i ? `${i.name}${variantLabel(i.size, i.color) ? ` (${variantLabel(i.size, i.color)})` : ""}` : "item";
    return r.kind === "archive_item" ? `Remove item: ${name}` : `Edit ${name}`;
  };

  const card = (r: ApprovalReq, actions: boolean) => {
    const i = r.item_id ? itemById.get(r.item_id) : null;
    return (
      <li key={r.id} className="grid gap-2 px-3 py-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="font-medium">{describe(r)}</div>
            <div className="text-xs text-muted-foreground">
              {storeNames[r.store_id]} · {peopleNames[r.requested_by] ?? "—"} · <LocalTime iso={r.requested_at} />
            </div>
          </div>
          {actions ? <ApprovalActions id={r.id} /> : (
            <span className={`rounded-md px-2 py-0.5 text-xs font-medium ${r.status === "approved" ? "bg-emerald-100 text-emerald-800" : r.status === "rejected" ? "bg-red-100 text-red-800" : "bg-amber-100 text-amber-800"}`}>
              {r.status}
            </span>
          )}
        </div>
        {r.kind === "edit_item" && r.changes && (
          <ul className="grid gap-0.5 rounded-md bg-muted/60 px-3 py-2 text-sm">
            {Object.entries(r.changes).map(([k, v]) => (
              <li key={k}>
                <span className="text-muted-foreground">{FIELD_LABELS[k] ?? k}:</span>{" "}
                {k !== "quantity_delta" && i && <><span className="line-through">{fmtField(k, i[k])}</span> → </>}
                <b>{fmtField(k, v)}</b>
                {k === "quantity_delta" && i && <span className="text-muted-foreground"> (currently {i.quantity})</span>}
              </li>
            ))}
          </ul>
        )}
        {r.reason && <p className="text-sm">“{r.reason}”</p>}
        {r.decision_note && <p className="text-xs text-muted-foreground">Note: {r.decision_note}</p>}
      </li>
    );
  };

  return (
    <div className="grid gap-4">
      <h1 className="text-2xl font-semibold">{isOwner ? "Approvals" : "My requests"}</h1>
      <p className="text-sm text-muted-foreground">
        {isOwner
          ? "Employees need your OK to remove items, remove stock or edit items after setup, and to void sales."
          : "Removing items, voiding sales, and edits after setup go to the owner for approval."}
      </p>
      <section className="grid gap-2">
        <h2 className="font-semibold">Pending ({pending.length})</h2>
        {pending.length === 0 ? <p className="text-sm text-muted-foreground">Nothing waiting.</p> : (
          <ul className="divide-y rounded-lg border bg-card">{pending.map((r) => card(r, isOwner))}</ul>
        )}
      </section>
      {done.length > 0 && (
        <section className="grid gap-2">
          <h2 className="font-semibold">History</h2>
          <ul className="divide-y rounded-lg border bg-card">{done.map((r) => card(r, false))}</ul>
        </section>
      )}
    </div>
  );
}
