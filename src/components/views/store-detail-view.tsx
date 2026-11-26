"use client";

import Link from "next/link";
import { CalendarDays, ChevronLeft, MapPin } from "lucide-react";
import { InventoryView, type InventoryStore } from "@/components/inventory/inventory-view";
import { LocalTime } from "@/components/local-time";
import { PaymentBadge } from "@/components/sales/payment-badge";
import { SetupBanner, StoreOwnerActions } from "@/components/stores/store-admin";
import { StoreStatusBadge, StoreTypeBadge } from "@/components/stores/store-badges";
import { formatMoney, formatStoreDate, variantLabel } from "@/lib/format";
import type { Item, PaymentMethod, Role, Store } from "@/lib/types";
import type { StoreTodaySummary } from "./stores-view";
import { useT, useLocale } from "@/i18n/client";

export type RecentSale = {
  id: string; item_name: string; size: string | null; color: string | null; quantity: number;
  total_cents: number; created_at: string; voided_at: string | null;
  payment_method?: PaymentMethod; cash_cents?: number; credit_cents?: number;
};

export function StoreDetailView({
  store, items, stores, today, recent, role, employees, memberIds,
}: {
  store: Store; items: Item[]; stores: InventoryStore[]; today?: StoreTodaySummary; recent: RecentSale[]; role: Role;
  employees: { id: string; full_name: string; active: boolean }[]; memberIds: string[];
}) {
  const t = useT();
  const locale = useLocale();
  const isOwner = role === "owner";
  const s = store;
  return (
    <div className="grid gap-4">
      <Link href="/stores" className="flex items-center gap-1 text-sm text-muted-foreground"><ChevronLeft className="size-4 rtl:rotate-180" /> {t("nav.stores")}</Link>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="grid gap-1.5">
          <h1 className="text-2xl font-semibold">{s.name}</h1>
          <div className="flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
            <StoreTypeBadge type={s.type} /> <StoreStatusBadge status={s.status} />
            {s.type === "popup" && (
              <span className="flex items-center gap-1"><CalendarDays className="size-4" />{formatStoreDate(s.starts_at, locale)} – {formatStoreDate(s.ends_at, locale)}</span>
            )}
            {s.address && <span className="flex items-center gap-1"><MapPin className="size-4" />{s.address}</span>}
          </div>
        </div>
        {isOwner && <StoreOwnerActions store={s} employees={employees} memberIds={memberIds} />}
      </div>

      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-lg border p-3"><div className="text-xs text-muted-foreground">{t("stores.today")}</div><div className="text-lg font-semibold">{formatMoney(today?.today_cents)}</div></div>
        <div className="rounded-lg border p-3"><div className="text-xs text-muted-foreground">{t("stores.unitsToday")}</div><div className="text-lg font-semibold">{today?.today_units ?? 0}</div></div>
        <div className="rounded-lg border p-3"><div className="text-xs text-muted-foreground">{t("stores.thisWeek")}</div><div className="text-lg font-semibold">{formatMoney(today?.week_cents)}</div></div>
      </div>

      <SetupBanner store={s} isOwner={isOwner} itemCount={items.filter((i) => !i.archived).length} />

      <InventoryView items={items} stores={stores} role={role} fixedStoreId={s.id} />

      <section className="grid gap-2">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">{t("stores.latestSales")}</h2>
          <Link href={`/sales?store=${s.id}`} className="text-sm underline">{t("stores.allSales")}</Link>
        </div>
        {recent.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("stores.noSales")}</p>
        ) : (
          <ul className="divide-y rounded-lg border text-sm">
            {recent.map((r) => (
              <li key={r.id} className={`flex items-center justify-between gap-2 px-3 py-2 ${r.voided_at ? "text-muted-foreground line-through" : ""}`}>
                <span className="flex min-w-0 items-center gap-1.5"><span className="truncate">{r.quantity} × {r.item_name}{variantLabel(r.size, r.color) && ` (${variantLabel(r.size, r.color)})`}</span><PaymentBadge method={r.payment_method} cashCents={r.cash_cents} creditCents={r.credit_cents} /></span>
                <span className="shrink-0">{formatMoney(r.total_cents)} · <LocalTime iso={r.created_at} /></span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
