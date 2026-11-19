import { cn } from "@/lib/utils";
import type { Store } from "@/lib/types";

export function StoreStatusBadge({ status }: { status: Store["status"] }) {
  const styles = {
    active: "bg-emerald-100 text-emerald-800 border-emerald-200",
    upcoming: "bg-sky-100 text-sky-800 border-sky-200",
    closed: "bg-zinc-100 text-zinc-600 border-zinc-200",
  }[status];
  return <span className={cn("rounded-md border px-2 py-0.5 text-xs font-medium capitalize", styles)}>{status}</span>;
}

export function StoreTypeBadge({ type }: { type: Store["type"] }) {
  return (
    <span className="rounded-md border px-2 py-0.5 text-xs font-medium">
      {type === "popup" ? "Pop-up" : "Permanent"}
    </span>
  );
}

export function SetupBadge({ locked }: { locked: boolean }) {
  return locked ? null : (
    <span className="rounded-md border border-violet-200 bg-violet-100 px-2 py-0.5 text-xs font-medium text-violet-800">
      Setup mode
    </span>
  );
}
