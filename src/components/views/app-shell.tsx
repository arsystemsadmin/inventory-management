import Link from "next/link";
import { Boxes } from "lucide-react";
import { AppNav } from "@/components/app-nav";
import type { Profile } from "@/lib/types";

/** Header + navigation shared by the Supabase and browser-demo layouts. */
export function AppShellView({
  businessName, profile, pendingApprovals, signOut, banner, children,
}: {
  businessName: string;
  profile: Pick<Profile, "full_name" | "role">;
  pendingApprovals: number;
  signOut: React.ReactNode;
  banner?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-dvh flex flex-col">
      <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-4 px-4">
          <Link href="/app" className="flex items-center gap-2 font-semibold shrink-0">
            <Boxes className="size-5" />
            <span className="truncate max-w-[10rem] sm:max-w-none">{businessName}</span>
          </Link>
          <AppNav variant="desktop" role={profile.role} pendingApprovals={pendingApprovals} />
          <div className="ml-auto flex items-center gap-2 text-sm">
            <span className="hidden sm:inline md:hidden xl:inline whitespace-nowrap text-muted-foreground">
              {profile.full_name} · {profile.role === "owner" ? "Owner" : "Employee"}
            </span>
            {signOut}
          </div>
        </div>
      </header>
      {banner}
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-5 pb-24 md:pb-8">{children}</main>
      <AppNav variant="mobile" role={profile.role} pendingApprovals={pendingApprovals} />
    </div>
  );
}
