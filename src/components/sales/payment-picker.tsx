"use client";

import { useState } from "react";
import { Banknote, CreditCard, Split, Wallet } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { centsToInput, formatMoney, parseMoneyToCents } from "@/lib/format";
import { PAYMENT_METHODS, type PaymentInput, type PaymentMethod } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useT } from "@/i18n/client";

const ICONS = { cash: Banknote, credit: CreditCard, split: Split, other: Wallet };
/** Common "other" methods in Israel, one tap to fill in. */
const OTHER_SUGGESTIONS = ["Bit", "PayBox", "bankTransfer", "check"] as const;

/** Cash / credit / split state for a given total. */
export function usePayment(total: number) {
  const [method, setMethod] = useState<PaymentMethod>("cash");
  // The field being typed in is kept as typed; the other is "total minus that".
  const [splitEdit, setSplitEdit] = useState<{ field: "cash" | "credit"; text: string }>({ field: "cash", text: "" });
  const [otherName, setOtherName] = useState("");
  const typed = parseMoneyToCents(splitEdit.text || "x");
  const typedOk = Number.isFinite(typed) && typed > 0 && typed < total;
  const cashCents = splitEdit.field === "cash" ? typed : total - typed;
  return {
    method, setMethod, splitEdit, setSplitEdit, total, typedOk, otherName, setOtherName,
    valid: (method !== "split" || typedOk) && (method !== "other" || otherName.trim().length > 0),
    cashText: splitEdit.field === "cash" ? splitEdit.text : typedOk ? centsToInput(total - typed) : "",
    creditText: splitEdit.field === "credit" ? splitEdit.text : typedOk ? centsToInput(total - typed) : "",
    input: (): PaymentInput => (method === "split" ? { method, cash_cents: cashCents }
      : method === "other" ? { method, other_name: otherName.trim().slice(0, 60) } : { method }),
    reset: () => { setMethod("cash"); setSplitEdit({ field: "cash", text: "" }); setOtherName(""); },
  };
}
export type PaymentState = ReturnType<typeof usePayment>;

export function PaymentPicker({ state }: { state: PaymentState }) {
  const t = useT();
  const { method, setMethod, setSplitEdit, valid, cashText, creditText, total, otherName, setOtherName } = state;
  return (
    <div className="grid gap-2">
      <div className="text-sm font-medium">{t("payment.method")}</div>
      <div className="grid grid-cols-4 gap-1.5" role="radiogroup" aria-label={t("payment.method")}>
        {PAYMENT_METHODS.map((m) => {
          const Icon = ICONS[m];
          return (
            <button key={m} type="button" role="radio" aria-checked={method === m} onClick={() => setMethod(m)}
              className={cn(
                "flex min-h-11 flex-col items-center justify-center gap-0.5 rounded-lg border px-1 py-1 text-xs font-semibold transition-colors sm:flex-row sm:gap-1.5 sm:text-sm",
                method === m ? "border-foreground bg-foreground text-background" : "bg-background hover:bg-muted",
              )}>
              <Icon className="size-4" /> {t(`payment.${m}`)}
            </button>
          );
        })}
      </div>
      {method === "other" && (
        <div className="grid gap-2">
          <Label htmlFor="pay-other">{t("payment.otherName")}</Label>
          <Input id="pay-other" autoFocus value={otherName} maxLength={60} dir="auto"
            placeholder={t("payment.otherPlaceholder")} onChange={(e) => setOtherName(e.target.value)}
            aria-invalid={!valid} />
          <div className="flex flex-wrap gap-1.5">
            {OTHER_SUGGESTIONS.map((s) => {
              const label = s === "Bit" || s === "PayBox" ? s : t(`payment.${s}`);
              return (
                <button key={s} type="button" onClick={() => setOtherName(label)}
                  className={cn("rounded-full border px-2.5 py-1 text-xs font-medium", otherName === label ? "border-foreground bg-foreground text-background" : "hover:bg-muted")}>
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      )}
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
          {method === "split" && !valid && <p className="col-span-2 text-xs text-destructive">{t("payment.splitMustMatch", { total: formatMoney(total) })}</p>}
        </div>
      )}
    </div>
  );
}
