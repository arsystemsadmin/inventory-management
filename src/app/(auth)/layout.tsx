import { Boxes } from "lucide-react";
import { NOT_CONNECTED_MESSAGE, supabaseConfigured } from "@/lib/supabase/config";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-dvh flex flex-col items-center justify-center px-4 py-10 bg-muted/40">
      <div className="mb-6 flex items-center gap-2 text-xl font-semibold">
        <Boxes className="size-6" /> Binventory
      </div>
      {!supabaseConfigured && (
        <div role="status" className="mb-4 w-full max-w-sm rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {NOT_CONNECTED_MESSAGE}
        </div>
      )}
      <div className="w-full max-w-sm">{children}</div>
    </main>
  );
}
