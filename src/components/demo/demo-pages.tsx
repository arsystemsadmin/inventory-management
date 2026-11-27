"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { InventoryView } from "@/components/inventory/inventory-view";
import { EmployeesTable } from "@/components/employees/employees-table";
import { ApprovalsView } from "@/components/views/approvals-view";
import { ClockView } from "@/components/views/clock-view";
import { DashboardView, type DashboardSummary } from "@/components/views/dashboard-view";
import { PayrollView, type PayrollRow } from "@/components/views/payroll-view";
import { isYmd } from "@/lib/dates";
import { SalesView } from "@/components/views/sales-view";
import { parseSalesRange, salesRangeStart } from "@/lib/sales-range";
import { StoreDetailView } from "@/components/views/store-detail-view";
import { StoresView } from "@/components/views/stores-view";
import { SettingsView } from "@/components/views/settings-view";
import { ColorDetailView, ProductDetailView, type DetailProps } from "@/components/views/product-detail-views";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";
import { setSessionUser } from "@/lib/demo/store";
import { tClient } from "@/i18n/client";
import {
  isOwner, periodStart, shiftPay, visibleApprovals, visibleItems, visiblePay, visiblePeople, visibleSales, visibleShifts, visibleStores,
} from "@/lib/demo/logic";
import type { DemoState, DemoUser } from "@/lib/demo/store";
import type { ShiftWithPay } from "@/lib/time";
import { STOCK_STATUSES, type StockStatus } from "@/lib/types";
import { DemoLoading, useDemoSession } from "./demo-shell";
import { useT } from "@/i18n/client";

// ------------------------------------------------------------- helpers ---

function salesSummary(s: DemoState, u: DemoUser, now: number): DashboardSummary[] {
  const day = periodStart("day", new Date(now)).toISOString();
  const week = periodStart("week", new Date(now)).toISOString();
  const sales = visibleSales(s, u).filter((x) => !x.voided_at && x.created_at >= week);
  return visibleStores(s, u).sort((a, b) => a.name.localeCompare(b.name)).map((st) => {
    const mine = sales.filter((x) => x.store_id === st.id);
    const today = mine.filter((x) => x.created_at >= day);
    return {
      store_id: st.id, store_name: st.name, store_status: st.status,
      today_cents: today.reduce((n, x) => n + x.total_cents, 0), today_units: today.reduce((n, x) => n + x.quantity, 0),
      week_cents: mine.reduce((n, x) => n + x.total_cents, 0), week_units: mine.reduce((n, x) => n + x.quantity, 0),
    };
  });
}

function withPay(s: DemoState, u: DemoUser, now: number): ShiftWithPay[] {
  return visibleShifts(s, u).map((t) => ({ ...t, ...shiftPay(t, now) }));
}

const names = (s: DemoState, u: DemoUser) => Object.fromEntries(visiblePeople(s, u).map((p) => [p.id, p.full_name]));
const inventoryStores = (s: DemoState, u: DemoUser) =>
  visibleStores(s, u).sort((a, b) => a.name.localeCompare(b.name))
    .map(({ id, business_id, name, inventory_locked_at, status }) => ({ id, business_id, name, inventory_locked_at, status }));
const localYmd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const ymdToLocal = (ymd: string) => { const [y, m, d] = ymd.split("-").map(Number); return new Date(y, m - 1, d); };

function OwnerOnly({ children }: { children: React.ReactNode }) {
  const { user } = useDemoSession();
  const router = useRouter();
  const ok = isOwner(user);
  useEffect(() => { if (!ok) router.replace("/stores"); }, [ok, router]);
  return ok ? <>{children}</> : <DemoLoading />;
}

// --------------------------------------------------------------- pages ---

export function DemoHome() {
  const { user } = useDemoSession();
  const router = useRouter();
  useEffect(() => { router.replace(isOwner(user) ? "/dashboard" : "/stores"); }, [user, router]);
  return <DemoLoading />;
}

export function DemoStoresPage() {
  const { state, user, now } = useDemoSession();
  const alerts: Record<string, number> = {};
  visibleItems(state, user).filter((i) => !i.archived && i.stock_status !== "OK")
    .forEach((i) => { alerts[i.store_id] = (alerts[i.store_id] ?? 0) + 1; });
  return <StoresView stores={visibleStores(state, user)} summary={salesSummary(state, user, now)} alertCounts={alerts} isOwner={isOwner(user)} />;
}

export function DemoStorePage({ id }: { id: string }) {
  const t = useT();
  const { state, user, now } = useDemoSession();
  const store = visibleStores(state, user).find((s) => s.id === id);
  if (!store) {
    return (
      <div className="grid gap-2 py-10 text-center">
        <h1 className="text-xl font-semibold">{t("stores.notFound")}</h1>
        <Link href="/stores" className="text-sm underline">{t("stores.backToStores")}</Link>
      </div>
    );
  }
  const owner = isOwner(user);
  return (
    <StoreDetailView
      store={store}
      items={visibleItems(state, user).filter((i) => i.store_id === id)}
      stores={inventoryStores(state, user).filter((s) => s.id === id)}
      today={salesSummary(state, user, now).find((s) => s.store_id === id)}
      recent={visibleSales(state, user).filter((s) => s.store_id === id).sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 8)}
      role={user.role}
      employees={owner ? state.users.filter((p) => p.business_id === user.business_id && p.role === "employee")
        .sort((a, b) => a.full_name.localeCompare(b.full_name)).map(({ id, full_name, active }) => ({ id, full_name, active })) : []}
      memberIds={owner ? state.members.filter((m) => m.store_id === id).map((m) => m.profile_id) : []}
    />
  );
}

export function DemoInventoryPage({ status }: { status?: string }) {
  const t = useT();
  const { state, user } = useDemoSession();
  const initial = status === "ALERTS" || STOCK_STATUSES.includes(status as StockStatus) ? (status as StockStatus | "ALERTS") : undefined;
  return (
    <div className="grid gap-4">
      <h1 className="text-2xl font-semibold">{t("nav.inventory")}</h1>
      <InventoryView items={visibleItems(state, user)} stores={inventoryStores(state, user)} role={user.role} initialStatus={initial} />
    </div>
  );
}

export function DemoSalesPage({ store, range: rangeParam }: { store?: string; range?: string }) {
  const { state, user, now } = useDemoSession();
  const range = parseSalesRange(rangeParam);
  const since = salesRangeStart(range, new Date(now)).toISOString();
  const sales = visibleSales(state, user)
    .filter((s) => s.created_at >= since && (!store || s.store_id === store))
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
  const pending = visibleApprovals(state, user).filter((r) => r.kind === "void_sale" && r.status === "pending").map((r) => r.sale_id!);
  return (
    <SalesView sales={sales} stores={inventoryStores(state, user)} peopleNames={names(state, user)}
      pendingVoidIds={pending} isOwner={isOwner(user)} range={range} store={store} asOf={new Date(now).toISOString()} />
  );
}

export function DemoApprovalsPage() {
  const { state, user } = useDemoSession();
  const reqs = visibleApprovals(state, user);
  return (
    <ApprovalsView
      reqs={reqs}
      items={state.items.filter((i) => reqs.some((r) => r.item_id === i.id))}
      sales={state.sales.filter((s) => reqs.some((r) => r.sale_id === s.id))}
      storeNames={Object.fromEntries(state.stores.filter((s) => s.business_id === user.business_id).map((s) => [s.id, s.name]))}
      peopleNames={Object.fromEntries(state.users.filter((p) => p.business_id === user.business_id).map((p) => [p.id, p.full_name]))}
      isOwner={isOwner(user)}
    />
  );
}

export function DemoClockPage() {
  const { state, user, now } = useDemoSession();
  const week = periodStart("week", new Date(now)).toISOString();
  const shifts = withPay(state, user, now).filter((t) => t.profile_id === user.id && (t.is_open || t.clock_in >= week));
  return (
    <ClockView
      shifts={shifts}
      rateCents={visiblePay(state, user).find((p) => p.profile_id === user.id)?.hourly_rate_cents ?? null}
      stores={inventoryStores(state, user).filter((s) => s.status !== "closed").map(({ id, name }) => ({ id, name }))}
      asOf={new Date(now).toISOString()}
    />
  );
}

export function DemoEmployeesPage() {
  return <OwnerOnly><EmployeesInner /></OwnerOnly>;
}
function EmployeesInner() {
  const { state, user } = useDemoSession();
  const employees = state.users
    .filter((p) => p.business_id === user.business_id && p.role === "employee")
    .sort((a, b) => Number(b.active) - Number(a.active) || a.full_name.localeCompare(b.full_name))
    .map((p) => ({
      id: p.id, full_name: p.full_name, email: p.email, active: p.active,
      rate_cents: state.pay.find((x) => x.profile_id === p.id)?.hourly_rate_cents ?? null,
      store_ids: state.members.filter((m) => m.profile_id === p.id).map((m) => m.store_id),
    }));
  const clockedIn = Object.fromEntries(visibleShifts(state, user).filter((t) => !t.clock_out).map((t) => [t.profile_id, t.store_id]));
  return <EmployeesTable employees={employees} stores={inventoryStores(state, user).map(({ id, name }) => ({ id, name }))} clockedIn={clockedIn} />;
}

export function DemoDashboardPage() {
  return <OwnerOnly><DashboardInner /></OwnerOnly>;
}
function DashboardInner() {
  const { state, user, now } = useDemoSession();
  const week = periodStart("week", new Date(now)).toISOString();
  const shifts = withPay(state, user, now);
  return (
    <DashboardView
      summary={salesSummary(state, user, now)}
      alerts={visibleItems(state, user).filter((i) => !i.archived && i.stock_status !== "OK")}
      openShifts={shifts.filter((t) => t.is_open)}
      weekPayrollCents={shifts.filter((t) => t.clock_in >= week).reduce((n, t) => n + t.amount_cents, 0)}
      pendingApprovals={visibleApprovals(state, user).filter((r) => r.status === "pending").length}
      recent={visibleSales(state, user).filter((s) => !s.voided_at).sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 10)}
      peopleNames={names(state, user)}
      asOf={new Date(now).toISOString()}
    />
  );
}

export function DemoPayrollPage({ from: fromParam, to: toParam }: { from?: string; to?: string }) {
  return <OwnerOnly><PayrollInner fromParam={fromParam} toParam={toParam} /></OwnerOnly>;
}
function PayrollInner({ fromParam, toParam }: { fromParam?: string; toParam?: string }) {
  const { state, user, now } = useDemoSession();
  const from = isYmd(fromParam) ? fromParam! : localYmd(periodStart("week", new Date(now)));
  const to = isYmd(toParam) && toParam! >= from ? toParam! : localYmd(new Date(now));
  const start = ymdToLocal(from).toISOString();
  const endDate = ymdToLocal(to); endDate.setDate(endDate.getDate() + 1);
  const end = endDate.toISOString();
  const entries = withPay(state, user, now).filter((t) => t.clock_in >= start && t.clock_in < end)
    .sort((a, b) => b.clock_in.localeCompare(a.clock_in));
  const people = state.users.filter((p) => p.business_id === user.business_id).sort((a, b) => a.full_name.localeCompare(b.full_name));
  const rate = (id: string) => state.pay.find((x) => x.profile_id === id)?.hourly_rate_cents ?? null;
  const rows: PayrollRow[] = people.map((p) => {
    const mine = entries.filter((t) => t.profile_id === p.id);
    return {
      profile_id: p.id, full_name: p.full_name, active: p.active, current_rate_cents: rate(p.id),
      shifts: mine.length, open_shifts: mine.filter((t) => t.is_open).length,
      worked_minutes: mine.reduce((n, t) => n + t.worked_minutes, 0), amount_cents: mine.reduce((n, t) => n + t.amount_cents, 0),
    };
  });
  return (
    <PayrollView
      from={from} to={to} rows={rows} entries={entries} asOf={new Date(now).toISOString()}
      people={people.filter((p) => p.role === "employee").map((p) => ({ id: p.id, full_name: p.full_name, rate_cents: rate(p.id) }))}
      stores={inventoryStores(state, user).map(({ id, name }) => ({ id, name }))}
    />
  );
}

export function DemoSettingsPage() {
  const { state, user } = useDemoSession();
  const router = useRouter();
  const business = state.businesses.find((b) => b.id === user.business_id);
  return (
    <SettingsView
      profile={user}
      businessName={business?.name ?? ""}
      signOut={
        <Button variant="outline" size="lg" onClick={() => { setSessionUser(null); router.replace("/login"); }}>
          <LogOut /> {tClient("common.signOut")}
        </Button>
      }
    />
  );
}

/** Same data the server loader returns, from browser storage. */
function useDemoDetail(id: string): Omit<DetailProps, "role"> | null {
  const { state, user } = useDemoSession();
  const items = visibleItems(state, user);
  const anchor = items.find((i) => i.id === id);
  if (!anchor) return null;
  const key = anchor.name.trim().toLowerCase();
  const siblings = items.filter((i) => i.store_id === anchor.store_id && i.name.trim().toLowerCase() === key);
  const ids = new Set(siblings.map((i) => i.id));
  return {
    anchor,
    siblings,
    store: inventoryStores(state, user).find((s) => s.id === anchor.store_id) ?? null,
    sales: visibleSales(state, user).filter((s) => ids.has(s.item_id)).sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 500),
    movements: state.movements.filter((m) => ids.has(m.item_id)).sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 300),
    peopleNames: names(state, user),
  };
}

function DemoNotFound() {
  const t = useT();
  return (
    <div className="grid gap-3 py-10 text-center text-sm text-muted-foreground">
      <p>{t("variation.notFound")}</p>
      <Link href="/inventory" className="underline">{t("nav.inventory")}</Link>
    </div>
  );
}

export function DemoProductPage({ id }: { id: string }) {
  const { user } = useDemoSession();
  const d = useDemoDetail(id);
  return d ? <ProductDetailView {...d} role={user.role} /> : <DemoNotFound />;
}

export function DemoColorPage({ id }: { id: string }) {
  const { user } = useDemoSession();
  const d = useDemoDetail(id);
  return d ? <ColorDetailView {...d} role={user.role} /> : <DemoNotFound />;
}
