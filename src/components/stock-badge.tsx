"use client";

import { cn } from "@/lib/utils";
import type { StockStatus } from "@/lib/types";
import { useT } from "@/i18n/client";

const STYLES: Record<StockStatus, string> = {
  OUT: "bg-red-600 text-white border-red-600",
  CRITICAL: "bg-orange-100 text-orange-800 border-orange-300",
  LOW: "bg-amber-100 text-amber-800 border-amber-300",
  OK: "bg-emerald-50 text-emerald-700 border-emerald-200",
};
const LABELS = { OUT: "stock.OUT", CRITICAL: "stock.CRITICAL", LOW: "stock.LOW", OK: "stock.OK" } as const;

export function StockBadge({ status, className }: { status: StockStatus; className?: string }) {
  const t = useT();
  return (
    <span className={cn("inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-semibold", STYLES[status], className)}>
      {t(LABELS[status])}
    </span>
  );
}
