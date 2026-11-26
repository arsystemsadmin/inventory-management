"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Boxes, Check, LayoutDashboard, Package, Store, Users } from "lucide-react";
import { toast } from "sonner";
import { useActions } from "@/lib/actions-context";
import { useT } from "@/i18n/client";
import { LanguageSwitcher } from "@/components/language-switcher";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { cn } from "@/lib/utils";

/**
 * First sign-in for an owner with no stores: create the first store, then
 * point them at the next steps. The app is locked until a store exists.
 */
export function OnboardingFlow({ ownerName, businessName }: { ownerName: string; businessName: string }) {
  const t = useT();
  const actions = useActions();
  const [pending, startTransition] = useTransition();
  const [storeId, setStoreId] = useState<string | null>(null);
  const [f, setF] = useState({ name: "", type: "popup", address: "", starts_on: "", ends_on: "" });
  const [showErrors, setShowErrors] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setF((s) => ({ ...s, [k]: e.target.value }));
  const nameMissing = !f.name.trim();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (nameMissing) { setShowErrors(true); return; }
    startTransition(async () => {
      const res = await actions.createStore({ ...f });
      if (!res.ok) { toast.error(res.error); return; }
      toast.success(res.message);
      setStoreId(res.data ?? null);
    });
  };

  const step = storeId ? 2 : 1;

  return (
    <main className="relative mx-auto flex min-h-dvh w-full max-w-lg flex-col gap-5 px-4 py-8">
      <LanguageSwitcher className="absolute end-4 top-4 bg-background" />
      <div className="flex items-center gap-2 text-lg font-semibold"><Boxes className="size-5" /> {businessName}</div>
      <div>
        <h1 className="text-2xl font-bold">{t("onboarding.welcome", { name: ownerName })}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("onboarding.intro")}</p>
      </div>

      <ol className="flex gap-2 text-xs font-medium">
        {[1, 2].map((n) => (
          <li key={n} className={cn("flex flex-1 items-center gap-2 rounded-full border px-3 py-1.5",
            step === n ? "border-foreground" : step > n ? "border-emerald-300 bg-emerald-50 text-emerald-800" : "text-muted-foreground")}>
            <span className={cn("grid size-5 place-items-center rounded-full text-[11px]",
              step > n ? "bg-emerald-600 text-white" : step === n ? "bg-foreground text-background" : "bg-muted")}>
              {step > n ? <Check className="size-3" /> : n}
            </span>
            {t(n === 1 ? "onboarding.step1" : "onboarding.step2")}
          </li>
        ))}
      </ol>

      {step === 1 ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Store className="size-5" /> {t("onboarding.createTitle")}</CardTitle>
            <CardDescription>{t("onboarding.createNote")}</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={submit} className="grid gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="o-name">{t("onboarding.storeName")}<span className="text-destructive" aria-hidden> *</span></Label>
                <Input id="o-name" value={f.name} onChange={set("name")} maxLength={200} autoFocus
                  placeholder={t("onboarding.storeNamePlaceholder")} aria-invalid={showErrors && nameMissing} />
                {showErrors && nameMissing && <p className="text-xs font-medium text-destructive">{t("form.required")}</p>}
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="o-type">{t("stores.type")}</Label>
                <NativeSelect id="o-type" value={f.type} onChange={set("type")}>
                  <option value="popup">{t("stores.popup")}</option>
                  <option value="permanent">{t("stores.permanent")}</option>
                </NativeSelect>
              </div>
              {f.type === "popup" && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="grid gap-1.5">
                    <Label htmlFor="o-start">{t("stores.starts")} <span className="font-normal text-muted-foreground">{t("common.optional")}</span></Label>
                    <Input id="o-start" type="date" value={f.starts_on} onChange={set("starts_on")} />
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="o-end">{t("stores.ends")} <span className="font-normal text-muted-foreground">{t("common.optional")}</span></Label>
                    <Input id="o-end" type="date" value={f.ends_on} onChange={set("ends_on")} />
                  </div>
                </div>
              )}
              <div className="grid gap-1.5">
                <Label htmlFor="o-address">{t("stores.address")} <span className="font-normal text-muted-foreground">{t("common.optional")}</span></Label>
                <Input id="o-address" value={f.address} onChange={set("address")} maxLength={300} />
              </div>
              <Button type="submit" size="lg" disabled={pending}>{pending ? t("common.saving") : t("onboarding.createButton")}</Button>
            </form>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Check className="size-5 text-emerald-600" /> {t("onboarding.doneTitle")}</CardTitle>
            <CardDescription>{t("onboarding.doneNote")}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2">
            <Button size="lg" asChild><Link href={`/stores/${storeId}`}><Package /> {t("onboarding.addProducts")}</Link></Button>
            <Button size="lg" variant="outline" asChild><Link href="/employees"><Users /> {t("onboarding.addEmployees")}</Link></Button>
            <Button size="lg" variant="ghost" asChild><Link href="/dashboard"><LayoutDashboard /> {t("onboarding.toDashboard")}</Link></Button>
          </CardContent>
        </Card>
      )}
    </main>
  );
}
