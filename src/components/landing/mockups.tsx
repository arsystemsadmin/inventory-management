"use client";

import { AlertTriangle, Boxes, ClipboardCheck, LayoutDashboard, Minus, Package, Plus, Receipt, Store, Users, Wallet } from "lucide-react";
import { useT } from "@/i18n/client";

/** Static illustrations of the real screens (pure HTML, no data). */

const STORES = [
  { name: "Main Street Shop", tag: "active", today: "₪1,060", week: "₪5,560" },
  { name: "Riverside Flea Market", tag: "active", today: "₪3,610", week: "₪8,090" },
  { name: "Winter Night Market", tag: "upcoming", today: "₪0", week: "₪0" },
] as const;
const ALERTS = [
  { name: "Leather Belt · M · Brown", qty: 0, s: "OUT" },
  { name: "Vintage Band Tee · L · Black", qty: 0, s: "OUT" },
  { name: "Selvedge Jeans · 32 · Indigo", qty: 1, s: "CRITICAL" },
  { name: "Bucket Hat · Black", qty: 2, s: "CRITICAL" },
] as const;

function Badge({ s }: { s: "OUT" | "CRITICAL" | "active" | "upcoming" }) {
  const t = useT();
  const cls = s === "OUT" ? "bg-red-600 text-white" : s === "CRITICAL" ? "bg-orange-100 text-orange-800" : s === "upcoming" ? "bg-sky-100 text-sky-800" : "bg-emerald-100 text-emerald-800";
  const label = s === "OUT" || s === "CRITICAL" ? t(`stock.${s}`) : t(`stores.status.${s as "active" | "upcoming"}`);
  return <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${cls}`}>{label}</span>;
}

export function DashboardMock() {
  const t = useT();
  return (
    <div className="overflow-hidden rounded-2xl border border-[var(--line)] bg-white shadow-[0_30px_80px_-30px_rgba(23,36,59,0.35)]">
      <div className="flex items-center gap-2 border-b border-[var(--line)] bg-[#f6f8fc] px-4 py-2.5">
        <span className="size-2.5 rounded-full bg-[#d9dee8]" /><span className="size-2.5 rounded-full bg-[#d9dee8]" /><span className="size-2.5 rounded-full bg-[#d9dee8]" />
        <span className="ms-3 hidden rounded-md bg-white px-3 py-1 text-[11px] text-[var(--muted)] sm:block">binventory.arsystems.dev/dashboard</span>
      </div>
      <div className="flex">
        <aside className="hidden w-44 shrink-0 border-e border-[var(--line)] p-3 md:block">
          <div className="mb-4 flex items-center gap-2">
            <span className="grid size-7 place-items-center rounded-lg bg-[var(--blue)] text-white"><Boxes className="size-4" /></span>
            <span className="text-sm font-bold">Binventory</span>
          </div>
          {([["dashboard", LayoutDashboard, true], ["stores", Store], ["inventory", Package], ["sales", Receipt], ["approvals", ClipboardCheck], ["employees", Users], ["payroll", Wallet]] as const).map(([label, Icon, active]) => {
            const I = Icon as typeof Store;
            return (
              <div key={label as string} className={`mb-0.5 flex items-center gap-2 rounded-md px-2 py-1.5 text-xs ${active ? "bg-[var(--blue-soft)] font-semibold text-[var(--blue-deep)]" : "text-[var(--muted)]"}`}>
                <I className="size-3.5" /> {t(`nav.${label}`)}
              </div>
            );
          })}
        </aside>
        <div className="min-w-0 flex-1 p-4 sm:p-5">
          <div className="text-lg font-bold">{t("nav.dashboard")}</div>
          <div className="mb-3 text-xs text-[var(--muted)]"><span className="me-1 inline-block size-1.5 rounded-full bg-emerald-500" />{t("landing.mock.live")}</div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[[t("dashboard.salesToday"), "₪4,670"], [t("stores.thisWeek"), "₪13,650"], [t("dashboard.onShiftNow"), "2 · ₪1,240"], [t("dashboard.stockAlerts"), "11"]].map(([k, v]) => (
              <div key={k} className="rounded-lg border border-[var(--line)] p-2.5">
                <div className="text-[10px] text-[var(--muted)]">{k}</div>
                <div className="text-base font-bold">{v}</div>
              </div>
            ))}
          </div>
          <div className="mt-3 grid gap-3 lg:grid-cols-2">
            <div className="rounded-lg border border-[var(--line)] p-3">
              <div className="mb-2 text-xs font-semibold">{t("dashboard.salesByStore")}</div>
              {STORES.map((s) => (
                <div key={s.name} className="flex items-center justify-between border-t border-[var(--line)] py-1.5 text-[11px] first:border-0">
                  <span className="flex min-w-0 items-center gap-1.5"><span className="truncate">{s.name}</span><Badge s={s.tag} /></span>
                  <span className="shrink-0 font-semibold">{s.today}</span>
                </div>
              ))}
            </div>
            <div className="rounded-lg border border-[var(--line)] p-3">
              <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold"><AlertTriangle className="size-3.5 text-amber-600" /> {t("dashboard.stockAlerts")}</div>
              {ALERTS.map((a) => (
                <div key={a.name} className="flex items-center justify-between border-t border-[var(--line)] py-1.5 text-[11px] first:border-0">
                  <span className="truncate">{a.name}</span>
                  <span className="flex shrink-0 items-center gap-1.5 font-semibold">{a.qty} <Badge s={a.s} /></span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function PhoneSellMock() {
  const t = useT();
  return (
    <div className="w-[230px] rounded-[2rem] border-[6px] border-[var(--night)] bg-[var(--night)] shadow-2xl">
      <div className="overflow-hidden rounded-[1.6rem] bg-white">
        <div className="bg-[#f6f8fc] px-4 pb-3 pt-4 text-[11px] text-[var(--muted)]">Riverside Flea Market</div>
        <div className="grid gap-2.5 rounded-t-2xl bg-white px-4 py-3">
          <div className="text-sm font-bold">{t("sell.title", { name: "Denim Jacket" })}</div>
          <div className="text-[11px] text-[var(--muted)]">₪180.00 each</div>
          <div className="text-[11px] font-semibold">{t("fields.size")}</div>
          <div className="flex gap-1.5">
            <span className="rounded-md bg-[var(--ink)] px-2.5 py-1 text-[11px] font-semibold text-white">M</span>
            <span className="rounded-md border border-[var(--line)] px-2.5 py-1 text-[11px]">L</span>
          </div>
          <div className="text-[11px] font-semibold">{t("fields.color")}</div>
          <div className="flex gap-1.5">
            <span className="rounded-md bg-[var(--ink)] px-2 py-1 text-[11px] font-semibold text-white">Dark wash</span>
            <span className="rounded-md border border-[var(--line)] px-2 py-1 text-[11px]">Light wash</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="grid size-7 place-items-center rounded-md border border-[var(--line)]"><Minus className="size-3" /></span>
            <span className="grid h-7 w-9 place-items-center rounded-md border border-[var(--line)] text-sm font-bold">2</span>
            <span className="grid size-7 place-items-center rounded-md border border-[var(--line)]"><Plus className="size-3" /></span>
            <span className="ms-auto text-sm font-bold">₪360.00</span>
          </div>
          <div className="rounded-lg bg-emerald-600 py-2 text-center text-[12px] font-semibold text-white">{t("sell.confirm", { label: "2 × M · Dark wash" })}</div>
        </div>
      </div>
    </div>
  );
}
