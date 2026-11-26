import { LogOut } from "lucide-react";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { ActiveStoreProvider } from "@/lib/active-store";
import { ACTIVE_STORE_COOKIE } from "@/lib/active-store-cookie";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { isDemoMode } from "@/lib/mode";
import { logout } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { LiveRefresh } from "@/components/live-refresh";
import { DemoShell } from "@/components/demo/demo-shell";
import { AppShellView } from "@/components/views/app-shell";
import { QuickSell, loadFromDatabase } from "@/components/quick-sell";
import { getT } from "@/i18n/server";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  if (isDemoMode) return <DemoShell>{children}</DemoShell>;

  const profile = await requireProfile();
  const t = await getT();
  const supabase = await createClient();
  // First sign-in: an owner without a store sets one up before anything else.
  if (profile.role === "owner") {
    const { count } = await supabase.from("stores").select("id", { count: "exact", head: true });
    if (!count) redirect("/onboarding");
  }
  const [{ data: business }, { count: pending }, { data: stores }, jar] = await Promise.all([
    supabase.from("businesses").select("name").single(),
    supabase.from("approval_requests").select("id", { count: "exact", head: true }).eq("status", "pending"),
    // RLS: owners see every store, employees only the ones they belong to.
    supabase.from("stores").select("id, name, status").order("name"),
    cookies(),
  ]);

  return (
    <ActiveStoreProvider
      stores={stores ?? []}
      defaultStoreId={profile.default_store_id ?? null}
      initialCookie={jar.get(ACTIVE_STORE_COOKIE)?.value}
    >
      <AppShellView
        businessName={business?.name ?? "Binventory"}
        profile={profile}
        pendingApprovals={pending ?? 0}
        floating={<QuickSell load={loadFromDatabase} />}
        signOut={
          <form action={logout}>
            <Button variant="ghost" size="icon" aria-label={t("common.signOut")}><LogOut /></Button>
          </form>
        }
      >
        {children}
      </AppShellView>
      {/* Keeps the approvals badge current for everyone. */}
      <LiveRefresh tables={["approval_requests", "stores"]} />
    </ActiveStoreProvider>
  );
}
