"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, Store, Package, Receipt, ClipboardCheck, Users, Wallet, Clock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Role } from "@/lib/types";

const OWNER = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/stores", label: "Stores", icon: Store },
  { href: "/inventory", label: "Inventory", icon: Package },
  { href: "/sales", label: "Sales", icon: Receipt },
  { href: "/approvals", label: "Approvals", icon: ClipboardCheck },
  { href: "/employees", label: "Employees", icon: Users },
  { href: "/payroll", label: "Payroll", icon: Wallet },
];
const EMPLOYEE = [
  { href: "/stores", label: "My stores", icon: Store },
  { href: "/inventory", label: "Inventory", icon: Package },
  { href: "/sales", label: "Sales", icon: Receipt },
  { href: "/clock", label: "Clock", icon: Clock },
  { href: "/approvals", label: "Requests", icon: ClipboardCheck },
];

export function AppNav({ role, pendingApprovals, variant }: { role: Role; pendingApprovals: number; variant: "desktop" | "mobile" }) {
  const pathname = usePathname();
  const items = role === "owner" ? OWNER : EMPLOYEE;
  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  const badge = (href: string) =>
    href === "/approvals" && pendingApprovals > 0 ? (
      <span className="absolute -top-1 right-0 md:static md:ml-1 min-w-4 h-4 rounded-full bg-red-600 px-1 text-[10px] leading-4 text-white text-center">
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
            <Icon className="size-4" /> {label}
            {badge(href)}
          </Link>
        ))}
      </nav>
  );
  // Mobile: thumb-reachable bottom tab bar. Must live outside the header:
  // backdrop-filter on an ancestor would make `fixed` relative to it.
  return (
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 border-t bg-background/95 backdrop-blur pb-[env(safe-area-inset-bottom)]">
        <div className="flex overflow-x-auto">
          {items.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                "relative flex min-w-[4.5rem] flex-1 flex-col items-center gap-0.5 px-1 py-2 text-[11px] font-medium",
                isActive(href) ? "text-foreground" : "text-muted-foreground",
              )}
            >
              <Icon className={cn("size-5", isActive(href) && "stroke-[2.5]")} />
              {label}
              {badge(href)}
            </Link>
          ))}
        </div>
      </nav>
  );
}
