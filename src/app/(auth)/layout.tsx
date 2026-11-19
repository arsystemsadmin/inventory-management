import { Boxes } from "lucide-react";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-dvh flex flex-col items-center justify-center px-4 py-10 bg-muted/40">
      <div className="mb-6 flex items-center gap-2 text-xl font-semibold">
        <Boxes className="size-6" /> Binventory
      </div>
      <div className="w-full max-w-sm">{children}</div>
    </main>
  );
}
