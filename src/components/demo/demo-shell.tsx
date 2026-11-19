"use client";

import { createContext, useContext, useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { AppShellView } from "@/components/views/app-shell";
import { ActionsProvider } from "@/lib/actions-context";
import { demoActions } from "@/lib/demo/actions";
import { currentUser, visibleApprovals, visibleSales } from "@/lib/demo/logic";
import { setSessionUser, tick, useDemo, type DemoState, type DemoUser } from "@/lib/demo/store";
import { formatMoney, variantLabel } from "@/lib/format";
import { PAY_REFRESH_MS } from "@/lib/time";

// Set while signing out, so the "no session -> login?next=" redirect doesn't race it.
let signingOut = false;

type DemoCtx = { state: DemoState; user: DemoUser; now: number };
const Ctx = createContext<DemoCtx | null>(null);
export function useDemoSession() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useDemoSession outside DemoShell");
  return v;
}

export function DemoLoading() {
  return <div className="flex min-h-[50dvh] items-center justify-center text-sm text-muted-foreground">Loading…</div>;
}

/** Owner gets a toast when someone else's sale lands (e.g. an employee in another tab). */
function SaleToasts({ state, user }: { state: DemoState; user: DemoUser }) {
  const seen = useRef<Set<string> | null>(null);
  useEffect(() => {
    const sales = visibleSales(state, user);
    if (!seen.current) { seen.current = new Set(sales.map((s) => s.id)); return; }
    for (const s of sales) {
      if (seen.current.has(s.id)) continue;
      seen.current.add(s.id);
      if (user.role === "owner" && s.sold_by !== user.id) {
        const v = variantLabel(s.size, s.color);
        toast.info(`New sale: ${s.quantity} × ${s.item_name}${v ? ` (${v})` : ""}`, { description: formatMoney(s.total_cents) });
      }
    }
  }, [state, user]);
  return null;
}

export function DemoShell({ children }: { children: React.ReactNode }) {
  const snap = useDemo();
  const router = useRouter();
  const pathname = usePathname();
  const user = snap ? currentUser(snap.state, snap.userId) : null;

  useEffect(() => {
    if (snap && !user && !signingOut) router.replace(`/login?next=${encodeURIComponent(pathname)}`);
  }, [snap, user, router, pathname]);

  useEffect(() => {
    const t = setInterval(tick, PAY_REFRESH_MS); // live pay figures
    return () => clearInterval(t);
  }, []);

  if (user) signingOut = false;
  if (!snap || !user) return <DemoLoading />;
  const business = snap.state.businesses.find((b) => b.id === user.business_id);
  const pending = visibleApprovals(snap.state, user).filter((r) => r.status === "pending").length;

  return (
    <ActionsProvider value={demoActions}>
      <Ctx.Provider value={{ state: snap.state, user, now: snap.now }}>
        <AppShellView
          businessName={business?.name ?? "Binventory"}
          profile={user}
          pendingApprovals={pending}
          signOut={
            <Button variant="ghost" size="icon" aria-label="Sign out"
              onClick={() => { signingOut = true; setSessionUser(null); router.replace("/login"); }}>
              <LogOut />
            </Button>
          }
          banner={
            <div className="border-b border-amber-200 bg-amber-50 px-4 py-1.5 text-center text-xs text-amber-900">
              Demo mode: data is saved in this browser only.
            </div>
          }
        >
          {children}
        </AppShellView>
        <SaleToasts state={snap.state} user={user} />
      </Ctx.Provider>
    </ActionsProvider>
  );
}
