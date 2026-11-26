"use client";

import { useActionState, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { login } from "@/app/actions/auth";
import { safeAction } from "@/lib/safe-call";

const safeLogin = safeAction("login", login);
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { demoAccounts, demoLogin } from "@/lib/demo/auth";
import { isDemoMode } from "@/lib/mode";
import { useT } from "@/i18n/client";

const safeNext = (n?: string) => (n && n.startsWith("/") && !n.startsWith("//") ? n : "/app");

export function LoginForm({ next, notice }: { next?: string; notice?: string }) {
  const router = useRouter();
  const t = useT();
  const [state, action, pending] = useActionState(
    async (prev: { error?: string } | undefined, form: FormData) => {
      if (!isDemoMode) return safeLogin(prev, form);
      const res = await demoLogin(form);
      if (!res.error) router.replace(safeNext(next));
      return res;
    },
    undefined,
  );
  const [email, setEmail] = useState("");
  const [accounts, setAccounts] = useState<ReturnType<typeof demoAccounts>>([]);
  useEffect(() => { if (isDemoMode) setAccounts(demoAccounts()); }, []);

  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader>
          <CardTitle>{t("auth.signIn")}</CardTitle>
          <CardDescription>{t("auth.signInNote")}</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={action} className="grid gap-4">
            <input type="hidden" name="next" value={next ?? "/app"} />
            <div className="grid gap-2">
              <Label htmlFor="email">{t("auth.email")}</Label>
              <Input id="email" name="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="password">{t("auth.password")}</Label>
              <Input id="password" name="password" type="password" autoComplete="current-password" required />
            </div>
            {(state?.error || notice) && (
              <p className="text-sm text-destructive" role="alert">{state?.error ?? notice}</p>
            )}
            <Button type="submit" size="lg" disabled={pending}>{pending ? t("auth.signingIn") : t("auth.signIn")}</Button>
            <p className="text-sm text-muted-foreground text-center">
              {t("auth.newBusiness")} <Link href="/signup" className="underline">{t("auth.createAccount")}</Link>
            </p>
          </form>
        </CardContent>
      </Card>
      {isDemoMode && accounts.length > 0 && (
        <Card className="gap-2 py-4">
          <CardHeader className="px-4">
            <CardTitle className="text-sm">{t("auth.accountsHere")}</CardTitle>
            <CardDescription>{t("auth.accountsNote")} <b>password123</b>.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-1 px-2">
            {accounts.map((a) => (
              <button key={a.email} type="button" onClick={() => setEmail(a.email)}
                className="flex min-h-11 items-center justify-between gap-2 rounded-md px-2 text-start text-sm hover:bg-muted">
                <span className="min-w-0">
                  <span className="block truncate font-medium">{a.name}{!a.active && " (deactivated)"}</span>
                  <span className="block truncate text-xs text-muted-foreground">{a.email}</span>
                </span>
                <span className="shrink-0 text-xs text-muted-foreground">{a.role === "owner" ? t("common.owner") : t("common.employee")} · {a.business}</span>
              </button>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
