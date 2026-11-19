"use client";

import { useActionState, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { login } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { demoAccounts, demoLogin } from "@/lib/demo/auth";
import { isDemoMode } from "@/lib/mode";

const safeNext = (n?: string) => (n && n.startsWith("/") && !n.startsWith("//") ? n : "/");

export function LoginForm({ next, notice }: { next?: string; notice?: string }) {
  const router = useRouter();
  const [state, action, pending] = useActionState(
    async (prev: { error?: string } | undefined, form: FormData) => {
      if (!isDemoMode) return login(prev, form);
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
          <CardTitle>Sign in</CardTitle>
          <CardDescription>Owners and employees sign in here.</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={action} className="grid gap-4">
            <input type="hidden" name="next" value={next ?? "/"} />
            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="password">Password</Label>
              <Input id="password" name="password" type="password" autoComplete="current-password" required />
            </div>
            {(state?.error || notice) && (
              <p className="text-sm text-destructive" role="alert">{state?.error ?? notice}</p>
            )}
            <Button type="submit" size="lg" disabled={pending}>{pending ? "Signing in…" : "Sign in"}</Button>
            <p className="text-sm text-muted-foreground text-center">
              New business? <Link href="/signup" className="underline">Create an account</Link>
            </p>
          </form>
        </CardContent>
      </Card>
      {isDemoMode && accounts.length > 0 && (
        <Card className="gap-2 py-4">
          <CardHeader className="px-4">
            <CardTitle className="text-sm">Accounts in this browser</CardTitle>
            <CardDescription>Tap one to fill in the email. Sample employees use the password <b>password123</b>.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-1 px-2">
            {accounts.map((a) => (
              <button key={a.email} type="button" onClick={() => setEmail(a.email)}
                className="flex min-h-11 items-center justify-between gap-2 rounded-md px-2 text-left text-sm hover:bg-muted">
                <span className="min-w-0">
                  <span className="block truncate font-medium">{a.name}{!a.active && " (deactivated)"}</span>
                  <span className="block truncate text-xs text-muted-foreground">{a.email}</span>
                </span>
                <span className="shrink-0 text-xs text-muted-foreground">{a.role === "owner" ? "Owner" : "Employee"} · {a.business}</span>
              </button>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
