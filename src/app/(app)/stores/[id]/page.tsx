import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarDays, ChevronLeft, MapPin } from "lucide-react";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { loadInventory } from "@/lib/queries";
import { InventoryView } from "@/components/inventory/inventory-view";
import { LiveRefresh } from "@/components/live-refresh";
import { SetupBanner, StoreOwnerActions } from "@/components/stores/store-admin";
import { StoreStatusBadge, StoreTypeBadge } from "@/components/stores/store-badges";
import { formatMoney, formatStoreDate, variantLabel } from "@/lib/format";
import { LocalTime } from "@/components/local-time";
import type { Store } from "@/lib/types";

export default async function StorePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const profile = await requireProfile();
  const supabase = await createClient();
  const isOwner = profile.role === "owner";

  const { data: store } = await supabase.from("stores").select("*").eq("id", id).maybeSingle();
  if (!store) notFound(); // RLS: unassigned stores simply don't exist for employees

  const [{ items, stores }, { data: summary }, { data: recent }, members, employees] = await Promise.all([
    loadInventory(id),
    supabase.rpc("sales_summary"),
    supabase.from("sales").select("id, item_name, size, color, quantity, total_cents, created_at, voided_at")
      .eq("store_id", id).order("created_at", { ascending: false }).limit(8),
    isOwner ? supabase.from("store_members").select("profile_id").eq("store_id", id) : Promise.resolve({ data: [] }),
    isOwner ? supabase.from("profiles").select("id, full_name, active").eq("role", "employee").order("full_name") : Promise.resolve({ data: [] }),
  ]);
  const s = store as Store;
  const today = (summary ?? []).find((r: { store_id: string }) => r.store_id === id) as
    | { today_cents: number; today_units: number; week_cents: number } | undefined;

  return (
    <div className="grid gap-4">
      <Link href="/stores" className="flex items-center gap-1 text-sm text-muted-foreground"><ChevronLeft className="size-4" /> Stores</Link>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="grid gap-1.5">
          <h1 className="text-2xl font-semibold">{s.name}</h1>
          <div className="flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
            <StoreTypeBadge type={s.type} /> <StoreStatusBadge status={s.status} />
            {s.type === "popup" && (
              <span className="flex items-center gap-1"><CalendarDays className="size-4" />{formatStoreDate(s.starts_at)} – {formatStoreDate(s.ends_at)}</span>
            )}
            {s.address && <span className="flex items-center gap-1"><MapPin className="size-4" />{s.address}</span>}
          </div>
        </div>
        {isOwner && (
          <StoreOwnerActions
            store={s}
            employees={(employees.data ?? []) as { id: string; full_name: string; active: boolean }[]}
            memberIds={(members.data ?? []).map((m: { profile_id: string }) => m.profile_id)}
          />
        )}
      </div>

      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-lg border p-3"><div className="text-xs text-muted-foreground">Today</div><div className="text-lg font-semibold">{formatMoney(today?.today_cents)}</div></div>
        <div className="rounded-lg border p-3"><div className="text-xs text-muted-foreground">Units today</div><div className="text-lg font-semibold">{today?.today_units ?? 0}</div></div>
        <div className="rounded-lg border p-3"><div className="text-xs text-muted-foreground">This week</div><div className="text-lg font-semibold">{formatMoney(today?.week_cents)}</div></div>
      </div>

      <SetupBanner store={s} isOwner={isOwner} itemCount={items.filter((i) => !i.archived).length} />

      <InventoryView items={items} stores={stores} role={profile.role} fixedStoreId={id} />

      <section className="grid gap-2">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Latest sales</h2>
          <Link href={`/sales?store=${id}`} className="text-sm underline">All sales</Link>
        </div>
        {(recent ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">No sales yet.</p>
        ) : (
          <ul className="divide-y rounded-lg border text-sm">
            {(recent ?? []).map((r) => (
              <li key={r.id} className={`flex items-center justify-between gap-2 px-3 py-2 ${r.voided_at ? "text-muted-foreground line-through" : ""}`}>
                <span className="min-w-0 truncate">{r.quantity} × {r.item_name}{variantLabel(r.size, r.color) && ` (${variantLabel(r.size, r.color)})`}</span>
                <span className="shrink-0">{formatMoney(r.total_cents)} · <LocalTime iso={r.created_at} /></span>
              </li>
            ))}
          </ul>
        )}
      </section>
      <LiveRefresh tables={["items", "sales", "stores"]} toastSales currentUserId={profile.id} />
    </div>
  );
}
