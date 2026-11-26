"use client";

import Link from "next/link";
import { AlertTriangle, CalendarDays, MapPin } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { NewStoreButton } from "@/components/stores/new-store-button";
import { SetupBadge, StoreStatusBadge, StoreTypeBadge } from "@/components/stores/store-badges";
import { formatMoney, formatStoreDate } from "@/lib/format";
import type { Store } from "@/lib/types";
import { useT, useLocale } from "@/i18n/client";

export type StoreTodaySummary = { store_id: string; today_cents: number; today_units: number; week_cents: number };

export function StoresView({
  stores, summary, alertCounts, isOwner,
}: {
  stores: Store[]; summary: StoreTodaySummary[]; alertCounts: Record<string, number>; isOwner: boolean;
}) {
  const t = useT();
  const locale = useLocale();
  const sales = new Map(summary.map((s) => [s.store_id, s]));
  const order = { active: 0, upcoming: 1, closed: 2 } as const;
  const list = [...stores].sort((a, b) => order[a.status] - order[b.status] || a.name.localeCompare(b.name));

  return (
    <div className="grid gap-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold">{isOwner ? t("nav.stores") : t("nav.myStores")}</h1>
        {isOwner && <NewStoreButton />}
      </div>
      {list.length === 0 && (
        <p className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">
          {isOwner ? t("stores.emptyOwner") : t("stores.emptyEmployee")}
        </p>
      )}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {list.map((s) => {
          const today = sales.get(s.id);
          const a = alertCounts[s.id] ?? 0;
          return (
            <Link key={s.id} href={`/stores/${s.id}`} className="block">
              <Card className="h-full transition-shadow hover:shadow-md">
                <CardHeader>
                  <CardTitle className="text-lg">{s.name}</CardTitle>
                  <div className="flex flex-wrap gap-1.5">
                    <StoreTypeBadge type={s.type} />
                    <StoreStatusBadge status={s.status} />
                    <SetupBadge locked={!!s.inventory_locked_at} />
                  </div>
                </CardHeader>
                <CardContent className="grid gap-1.5 text-sm text-muted-foreground">
                  {s.type === "popup" && (s.starts_at || s.ends_at) && (
                    <div className="flex items-center gap-1.5">
                      <CalendarDays className="size-4" /> {formatStoreDate(s.starts_at, locale)} – {formatStoreDate(s.ends_at, locale)}
                    </div>
                  )}
                  {s.address && <div className="flex items-center gap-1.5"><MapPin className="size-4" /> {s.address}</div>}
                  <div className="mt-1 flex items-center justify-between text-foreground">
                    <span>{t("stores.today")}: <b>{formatMoney(today?.today_cents ?? 0)}</b> · {t("stores.soldCount", { count: today?.today_units ?? 0 })}</span>
                    {a > 0 && (
                      <span className="flex items-center gap-1 text-amber-700 font-medium">
                        <AlertTriangle className="size-4" /> {a}
                      </span>
                    )}
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
