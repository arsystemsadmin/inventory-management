import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { LiveRefresh } from "@/components/live-refresh";
import { LocalTime } from "@/components/local-time";
import { SaleRowActions } from "@/components/sales/sale-row-actions";
import { formatMoney, variantLabel } from "@/lib/format";
import type { Sale } from "@/lib/types";

export const metadata = { title: "Sales · Binventory" };

const RANGES = { today: 1, "7d": 7, "30d": 30 } as const;

export default async function SalesPage({ searchParams }: { searchParams: Promise<{ store?: string; range?: string }> }) {
  const profile = await requireProfile();
  const isOwner = profile.role === "owner";
  const { store, range: rangeParam } = await searchParams;
  const range = (rangeParam && rangeParam in RANGES ? rangeParam : "7d") as keyof typeof RANGES;
  const supabase = await createClient();

  const since = new Date();
  since.setHours(0, 0, 0, 0);
  since.setDate(since.getDate() - (RANGES[range] - 1));

  let q = supabase.from("sales").select("*").gte("created_at", since.toISOString())
    .order("created_at", { ascending: false }).limit(300);
  if (store && /^[0-9a-f-]{36}$/i.test(store)) q = q.eq("store_id", store);

  const [{ data: salesData }, { data: stores }, { data: people }, { data: pendingVoids }] = await Promise.all([
    q,
    supabase.from("stores").select("id, name").order("name"),
    supabase.from("profiles").select("id, full_name"),
    supabase.from("approval_requests").select("sale_id").eq("kind", "void_sale").eq("status", "pending"),
  ]);
  const sales = (salesData ?? []) as Sale[];
  const storeName = new Map((stores ?? []).map((s) => [s.id, s.name]));
  const personName = new Map((people ?? []).map((p) => [p.id, p.full_name]));
  const pendingSet = new Set((pendingVoids ?? []).map((r) => r.sale_id));
  const valid = sales.filter((s) => !s.voided_at);
  const total = valid.reduce((n, s) => n + s.total_cents, 0);
  const units = valid.reduce((n, s) => n + s.quantity, 0);

  const qs = (patch: Record<string, string | undefined>) => {
    const p = new URLSearchParams({ ...(store ? { store } : {}), range, ...patch } as Record<string, string>);
    for (const [k, v] of [...p.entries()]) if (!v) p.delete(k);
    return `/sales?${p}`;
  };

  return (
    <div className="grid gap-4">
      <h1 className="text-2xl font-semibold">Sales</h1>
      <form className="flex flex-wrap gap-2" action="/sales">
        <select name="store" defaultValue={store ?? ""} className="h-10 rounded-md border bg-background px-3">
          <option value="">All stores</option>
          {(stores ?? []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <input type="hidden" name="range" value={range} />
        <button className="h-10 rounded-md border px-4 text-sm font-medium" type="submit">Apply</button>
        <div className="flex gap-1">
          {(Object.keys(RANGES) as (keyof typeof RANGES)[]).map((r) => (
            <a key={r} href={qs({ range: r })}
              className={`flex h-10 items-center rounded-md border px-3 text-sm ${r === range ? "bg-foreground text-background" : ""}`}>
              {r === "today" ? "Today" : r === "7d" ? "7 days" : "30 days"}
            </a>
          ))}
        </div>
      </form>

      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-lg border p-3"><div className="text-xs text-muted-foreground">Revenue</div><div className="text-lg font-semibold">{formatMoney(total)}</div></div>
        <div className="rounded-lg border p-3"><div className="text-xs text-muted-foreground">Units</div><div className="text-lg font-semibold">{units}</div></div>
        <div className="rounded-lg border p-3"><div className="text-xs text-muted-foreground">Sales</div><div className="text-lg font-semibold">{valid.length}</div></div>
      </div>

      {sales.length === 0 ? (
        <p className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">No sales in this period.</p>
      ) : (
        <ul className="divide-y rounded-lg border bg-card">
          {sales.map((s) => {
            const v = variantLabel(s.size, s.color);
            const label = `${s.quantity} × ${s.item_name}${v ? ` (${v})` : ""}`;
            return (
              <li key={s.id} className="flex items-center gap-3 px-3 py-3">
                <div className="min-w-0 flex-1">
                  <div className={`font-medium ${s.voided_at ? "line-through text-muted-foreground" : ""}`}>{label}</div>
                  <div className="text-xs text-muted-foreground">
                    <LocalTime iso={s.created_at} /> · {storeName.get(s.store_id)} · {personName.get(s.sold_by) ?? "—"}
                    {s.voided_at && <span className="ml-1 font-medium text-red-700">· Voided</span>}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-semibold">{formatMoney(s.total_cents)}</div>
                  <div className="text-xs text-muted-foreground">{formatMoney(s.unit_price_cents)} ea</div>
                </div>
                {!s.voided_at && (
                  <SaleRowActions saleId={s.id} label={label} isOwner={isOwner} pendingRequest={pendingSet.has(s.id)} />
                )}
              </li>
            );
          })}
        </ul>
      )}
      <LiveRefresh tables={["sales"]} toastSales={isOwner} currentUserId={profile.id} />
    </div>
  );
}
