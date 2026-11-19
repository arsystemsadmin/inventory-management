import Link from "next/link";
import { Boxes, LogOut } from "lucide-react";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { logout } from "@/app/actions/auth";
import { AppNav } from "@/components/app-nav";
import { Button } from "@/components/ui/button";
import { LiveRefresh } from "@/components/live-refresh";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireProfile();
  const supabase = await createClient();
  const [{ data: business }, { count: pending }] = await Promise.all([
    supabase.from("businesses").select("name").single(),
    supabase.from("approval_requests").select("id", { count: "exact", head: true }).eq("status", "pending"),
  ]);

  return (
    <div className="min-h-dvh flex flex-col">
      <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-4 px-4">
          <Link href="/" className="flex items-center gap-2 font-semibold shrink-0">
            <Boxes className="size-5" />
            <span className="truncate max-w-[10rem] sm:max-w-none">{business?.name ?? "Binventory"}</span>
          </Link>
          <AppNav variant="desktop" role={profile.role} pendingApprovals={pending ?? 0} />
          <div className="ml-auto flex items-center gap-2 text-sm">
            <span className="hidden sm:inline md:hidden xl:inline whitespace-nowrap text-muted-foreground">
              {profile.full_name} · {profile.role === "owner" ? "Owner" : "Employee"}
            </span>
            <form action={logout}>
              <Button variant="ghost" size="icon" aria-label="Sign out"><LogOut /></Button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-5 pb-24 md:pb-8">{children}</main>
      <AppNav variant="mobile" role={profile.role} pendingApprovals={pending ?? 0} />
      {/* Keeps the approvals badge current for everyone. */}
      <LiveRefresh tables={["approval_requests"]} />
    </div>
  );
}
