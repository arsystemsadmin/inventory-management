import { Boxes } from "lucide-react";
import { supabaseConfigured } from "@/lib/supabase/config";
import { LanguageSwitcher } from "@/components/language-switcher";
import { getT } from "@/i18n/server";

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const t = await getT();
  return (
    <main className="relative min-h-dvh flex flex-col items-center justify-center px-4 py-10 bg-muted/40">
      <LanguageSwitcher className="absolute end-4 top-4 bg-background" />
      <div className="mb-6 flex items-center gap-2 text-xl font-semibold">
        <Boxes className="size-6" /> Binventory
      </div>
      {!supabaseConfigured && (
        <div role="status" className="mb-4 w-full max-w-sm rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {t("demo.notConnected")}
        </div>
      )}
      <div className="w-full max-w-sm">{children}</div>
    </main>
  );
}
