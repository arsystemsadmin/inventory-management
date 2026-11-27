"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, Store, Package, Receipt, ClipboardCheck, Users, Wallet, Clock, Settings, Menu, X,
} from "lucide-react";
import { LanguageSwitcher } from "@/components/language-switcher";
import { cn } from "@/lib/utils";
import { useT } from "@/i18n/client";
import type { Role } from "@/lib/types";

const OWNER = [
  { href: "/dashboard", label: "nav.dashboard", icon: LayoutDashboard },
  { href: "/stores", label: "nav.stores", icon: Store },
  { href: "/inventory", label: "nav.inventory", icon: Package },
  { href: "/sales", label: "nav.sales", icon: Receipt },
  { href: "/approvals", label: "nav.approvals", icon: ClipboardCheck },
  { href: "/employees", label: "nav.employees", icon: Users },
  { href: "/payroll", label: "nav.payroll", icon: Wallet },
  { href: "/settings", label: "nav.settings", icon: Settings },
] as const;
const EMPLOYEE = [
  { href: "/stores", label: "nav.myStores", icon: Store },
  { href: "/inventory", label: "nav.inventory", icon: Package },
  { href: "/sales", label: "nav.sales", icon: Receipt },
  { href: "/clock", label: "nav.clock", icon: Clock },
  { href: "/approvals", label: "nav.requests", icon: ClipboardCheck },
  { href: "/settings", label: "nav.settings", icon: Settings },
] as const;

// Phone tab bar: the few tabs used all day; everything else lives under "More".
const MOBILE_MAIN: Record<Role, string[]> = {
  owner: ["/dashboard", "/inventory", "/sales", "/approvals"],
  employee: ["/inventory", "/sales", "/clock"],
};

export function AppNav({ role, pendingApprovals, variant }: { role: Role; pendingApprovals: number; variant: "desktop" | "mobile" }) {
  const pathname = usePathname();
  const t = useT();
  const items = role === "owner" ? OWNER : EMPLOYEE;
  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  const badge = (href: string) =>
    href === "/approvals" && pendingApprovals > 0 ? (
      <span className="absolute -top-1 end-0 md:static md:ms-1 min-w-4 h-4 rounded-full bg-red-600 px-1 text-[10px] leading-4 text-white text-center">
        {pendingApprovals}
      </span>
    ) : null;

  if (variant === "desktop") return (
      <nav className="hidden md:flex items-center gap-1">
        {items.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              isActive(href) ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className="size-4" /> {t(label)}
            {badge(href)}
          </Link>
        ))}
      </nav>
  );
  // Mobile: thumb-reachable bottom tab bar. Must live outside the header:
  // backdrop-filter on an ancestor would make `fixed` relative to it.
  return <MobileNav items={items} role={role} pendingApprovals={pendingApprovals} isActive={isActive} badge={badge} />;
}

function MobileNav({
  items, role, pendingApprovals, isActive, badge,
}: {
  items: readonly { href: string; label: string; icon: React.ComponentType<{ className?: string }> }[];
  role: Role;
  pendingApprovals: number;
  isActive: (href: string) => boolean;
  badge: (href: string) => React.ReactNode;
}) {
  const t = useT();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const main = items.filter((i) => MOBILE_MAIN[role].includes(i.href));
  const more = items.filter((i) => !MOBILE_MAIN[role].includes(i.href));
  const moreActive = more.some((i) => isActive(i.href));
  // Badge on "More" when something inside it needs attention.
  const moreBadge = more.some((i) => i.href === "/approvals") && pendingApprovals > 0;

  useEffect(() => { setOpen(false); }, [pathname]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const tab = "relative flex flex-1 flex-col items-center gap-0.5 px-1 py-2 text-[11px] font-medium";
  return (
    <>
      {open && (
        <div className="md:hidden fixed inset-0 z-40 bg-black/30" onClick={() => setOpen(false)} aria-hidden />
      )}
      {open && (
        <div
          id="more-menu"
          role="menu"
          className="md:hidden fixed inset-x-2 z-50 rounded-2xl border bg-background p-2 shadow-xl bottom-[calc(4.25rem+env(safe-area-inset-bottom))]"
        >
          <ul className="grid gap-1">
            {more.map(({ href, label, icon: Icon }) => (
              <li key={href}>
                <Link
                  href={href}
                  role="menuitem"
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-3 text-base font-medium",
                    isActive(href) ? "bg-secondary" : "hover:bg-muted",
                  )}
                >
                  <Icon className="size-5 text-muted-foreground" />
                  <span className="flex-1">{t(label as never)}</span>
                  {href === "/approvals" && pendingApprovals > 0 && (
                    <span className="min-w-5 rounded-full bg-red-600 px-1.5 text-center text-xs leading-5 text-white">{pendingApprovals}</span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
          <div className="mt-1 flex items-center justify-between border-t px-3 pt-3 pb-1">
            <span className="text-sm text-muted-foreground">{t("common.language")}</span>
            <LanguageSwitcher />
          </div>
        </div>
      )}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-50 border-t bg-background/95 backdrop-blur pb-[env(safe-area-inset-bottom)]">
        <div className="flex">
          {main.map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href} className={cn(tab, isActive(href) ? "text-foreground" : "text-muted-foreground")}>
              <Icon className={cn("size-6", isActive(href) && "stroke-[2.5]")} />
              {t(label as never)}
              {badge(href)}
            </Link>
          ))}
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-controls="more-menu"
            className={cn(tab, moreActive || open ? "text-foreground" : "text-muted-foreground")}
          >
            {open ? <X className="size-6" /> : <Menu className={cn("size-6", moreActive && "stroke-[2.5]")} />}
            {t("nav.more")}
            {moreBadge && <span className="absolute top-1.5 end-[30%] size-2.5 rounded-full bg-red-600" aria-hidden />}
          </button>
        </div>
      </nav>
    </>
  );
}
