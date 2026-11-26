"use client";

import { useActionState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signup } from "@/app/actions/auth";
import { safeAction } from "@/lib/safe-call";

const safeSignup = safeAction("signup", signup);
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { demoSignup } from "@/lib/demo/auth";
import { isDemoMode } from "@/lib/mode";
import { useT } from "@/i18n/client";

export default function SignupPage() {
  const router = useRouter();
  const t = useT();
  const [state, action, pending] = useActionState(
    async (prev: { error?: string; message?: string } | undefined, form: FormData): Promise<{ error?: string; message?: string } | undefined> => {
      if (!isDemoMode) return safeSignup(prev, form);
      const res = await demoSignup(form);
      if (!res.error) router.replace("/app");
      return res;
    },
    undefined,
  );
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("auth.createBusiness")}</CardTitle>
        <CardDescription>{t("auth.createBusinessNote")}</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={action} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="business_name">{t("auth.businessName")}</Label>
            <Input id="business_name" name="business_name" required maxLength={200} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="full_name">{t("auth.yourName")}</Label>
            <Input id="full_name" name="full_name" autoComplete="name" required maxLength={200} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="email">{t("auth.email")}</Label>
            <Input id="email" name="email" type="email" autoComplete="email" required />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="password">{t("auth.password")}</Label>
            <Input id="password" name="password" type="password" autoComplete="new-password" minLength={8} required />
          </div>
          {isDemoMode && (
            <label className="flex items-start gap-3 rounded-md border p-3 text-sm">
              <Checkbox name="sample" defaultChecked className="mt-0.5" />
              <span>
                <span className="font-medium">{t("auth.loadSample")}</span>
                <span className="block text-muted-foreground">{t("auth.loadSampleNote")}</span>
              </span>
            </label>
          )}
          {state?.error && <p className="text-sm text-destructive" role="alert">{state.error}</p>}
          {state?.message && <p className="text-sm text-emerald-700">{state.message}</p>}
          <Button type="submit" size="lg" disabled={pending}>{pending ? t("auth.creating") : t("auth.createAccount")}</Button>
          <p className="text-sm text-muted-foreground text-center">
            {t("auth.haveAccount")} <Link href="/login" className="underline">{t("auth.signIn")}</Link>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
