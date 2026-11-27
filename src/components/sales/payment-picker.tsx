"use client";

import { useState } from "react";
import { Banknote, CreditCard, Split } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { centsToInput, formatMoney, parseMoneyToCents } from "@/lib/format";
import { PAYMENT_METHODS, type PaymentInput, type PaymentMethod } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useT } from "@/i18n/client";

const ICONS = { cash: Banknote, credit: CreditCard, split: Split };

/** Cash / credit / split state for a given total. */
export function usePayment(total: number) {
  const [method, setMethod] = useState<PaymentMethod>("cash");
  // The field being typed in is kept as typed; the other is "total minus that".
  const [splitEdit, setSplitEdit] = useState<{ field: "cash" | "credit"; text: string }>({ field: "cash", text: "" });
  const typed = parseMoneyToCents(splitEdit.text || "x");
  const typedOk = Number.isFinite(typed) && typed > 0 && typed < total;
  const cashCents = splitEdit.field === "cash" ? typed : total - typed;
  return {
    method, setMethod, splitEdit, setSplitEdit, total, typedOk,
    valid: method !== "split" || typedOk,
    cashText: splitEdit.field === "cash" ? splitEdit.text : typedOk ? centsToInput(total - typed) : "",
    creditText: splitEdit.field === "credit" ? splitEdit.text : typedOk ? centsToInput(total - typed) : "",
    input: (): PaymentInput => (method === "split" ? { method, cash_cents: cashCents } : { method }),
    reset: () => { setMethod("cash"); setSplitEdit({ field: "cash", text: "" }); },
  };
}
export type PaymentState = ReturnType<typeof usePayment>;

export function PaymentPicker({ state }: { state: PaymentState }) {
  const t = useT();
  const { method, setMethod, setSplitEdit, valid, cashText, creditText, total } = state;
  return (
    <div className="grid gap-2">
      <div className="text-sm font-medium">{t("payment.method")}</div>
      <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label={t("payment.method")}>
        {PAYMENT_METHODS.map((m) => {
          const Icon = ICONS[m];
          return (
            <button key={m} type="button" role="radio" aria-checked={method === m} onClick={() => setMethod(m)}
              className={cn(
                "flex min-h-11 items-center justify-center gap-1.5 rounded-lg border px-2 text-sm font-semibold transition-colors",
                method === m ? "border-foreground bg-foreground text-background" : "bg-background hover:bg-muted",
              )}>
              <Icon className="size-4" /> {t(`payment.${m}`)}
            </button>
          );
        })}
      </div>
      {method === "split" && (
        <div className="grid grid-cols-2 gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="pay-cash">{t("payment.cashAmount")}</Label>
            <Input id="pay-cash" inputMode="decimal" autoFocus value={cashText} placeholder="0.00"
              onChange={(e) => setSplitEdit({ field: "cash", text: e.target.value })} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="pay-credit">{t("payment.creditAmount")}</Label>
            <Input id="pay-credit" inputMode="decimal" value={creditText} placeholder="0.00"
              onChange={(e) => setSplitEdit({ field: "credit", text: e.target.value })} />
          </div>
          {!valid && <p className="col-span-2 text-xs text-destructive">{t("payment.splitMustMatch", { total: formatMoney(total) })}</p>}
        </div>
      )}
    </div>
  );
}
