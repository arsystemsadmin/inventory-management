import { LogOut } from "lucide-react";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { isDemoMode } from "@/lib/mode";
import { logout } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { SettingsView } from "@/components/views/settings-view";
import { DemoSettingsPage } from "@/components/demo/demo-pages";
import { getT } from "@/i18n/server";

export async function generateMetadata() {
  const t = await getT();
  return { title: `${t("nav.settings")} · Binventory` };
}

export default async function SettingsPage() {
  if (isDemoMode) return <DemoSettingsPage />;
  const profile = await requireProfile();
  const t = await getT();
  const supabase = await createClient();
  const { data: business } = await supabase.from("businesses").select("name").single();
  return (
    <SettingsView
      profile={profile}
      businessName={business?.name ?? ""}
      signOut={
        <form action={logout}>
          <Button variant="outline" size="lg"><LogOut /> {t("common.signOut")}</Button>
        </form>
      }
    />
  );
}
