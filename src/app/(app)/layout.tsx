import { LogOut } from "lucide-react";
import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { isDemoMode } from "@/lib/mode";
import { logout } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { LiveRefresh } from "@/components/live-refresh";
import { DemoShell } from "@/components/demo/demo-shell";
import { AppShellView } from "@/components/views/app-shell";
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
  const [{ data: business }, { count: pending }] = await Promise.all([
    supabase.from("businesses").select("name").single(),
    supabase.from("approval_requests").select("id", { count: "exact", head: true }).eq("status", "pending"),
  ]);

  return (
    <>
      <AppShellView
        businessName={business?.name ?? "Binventory"}
        profile={profile}
        pendingApprovals={pending ?? 0}
        signOut={
          <form action={logout}>
            <Button variant="ghost" size="icon" aria-label={t("common.signOut")}><LogOut /></Button>
          </form>
        }
      >
        {children}
      </AppShellView>
      {/* Keeps the approvals badge current for everyone. */}
      <LiveRefresh tables={["approval_requests"]} />
    </>
  );
}
