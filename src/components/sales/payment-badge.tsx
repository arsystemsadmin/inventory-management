"use client";

import { Banknote, CreditCard, Split } from "lucide-react";
import { useT } from "@/i18n/client";
import { cn } from "@/lib/utils";
import { formatMoney } from "@/lib/format";
import type { PaymentMethod } from "@/lib/types";

const STYLES: Record<PaymentMethod, string> = {
  cash: "border-emerald-200 bg-emerald-50 text-emerald-800",
  credit: "border-sky-200 bg-sky-50 text-sky-800",
  split: "border-violet-200 bg-violet-50 text-violet-800",
};
const ICONS = { cash: Banknote, credit: CreditCard, split: Split };

/** Small badge showing how a sale was paid. Older sales without a method count as cash. */
export function PaymentBadge({
  method, cashCents, creditCents, showAmounts = false, className,
}: {
  method?: PaymentMethod | null; cashCents?: number; creditCents?: number; showAmounts?: boolean; className?: string;
}) {
  const t = useT();
  const m: PaymentMethod = method ?? "cash";
  const Icon = ICONS[m];
  const detail = m === "split" && cashCents != null && creditCents != null
    ? `${formatMoney(cashCents)} ${t("payment.cash")} + ${formatMoney(creditCents)} ${t("payment.credit")}`
    : undefined;
  return (
    <span
      title={detail}
      className={cn("inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] font-semibold whitespace-nowrap", STYLES[m], className)}
    >
      <Icon className="size-3" aria-hidden />
      {t(`payment.${m}`)}
      {showAmounts && detail && <span className="font-normal">· {detail}</span>}
    </span>
  );
}
