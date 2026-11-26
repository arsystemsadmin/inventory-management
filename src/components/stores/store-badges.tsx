"use client";

import { cn } from "@/lib/utils";
import type { Store } from "@/lib/types";
import { useT } from "@/i18n/client";

export function StoreStatusBadge({ status }: { status: Store["status"] }) {
  const t = useT();
  const styles = {
    active: "bg-emerald-100 text-emerald-800 border-emerald-200",
    upcoming: "bg-sky-100 text-sky-800 border-sky-200",
    closed: "bg-zinc-100 text-zinc-600 border-zinc-200",
  }[status];
  return <span className={cn("rounded-md border px-2 py-0.5 text-xs font-medium", styles)}>{t(`stores.status.${status}`)}</span>;
}

export function StoreTypeBadge({ type }: { type: Store["type"] }) {
  const t = useT();
  return (
    <span className="rounded-md border px-2 py-0.5 text-xs font-medium">
      {type === "popup" ? t("stores.popup") : t("stores.permanent")}
    </span>
  );
}

export function SetupBadge({ locked }: { locked: boolean }) {
  const t = useT();
  return locked ? null : (
    <span className="rounded-md border border-violet-200 bg-violet-100 px-2 py-0.5 text-xs font-medium text-violet-800">
      {t("stores.setupMode")}
    </span>
  );
}
