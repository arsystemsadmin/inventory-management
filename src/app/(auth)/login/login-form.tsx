"use client";

import { useActionState } from "react";
import Link from "next/link";
import { login } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function LoginForm({ next, notice }: { next?: string; notice?: string }) {
  const [state, action, pending] = useActionState(login, undefined);
  return (
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
            <Input id="email" name="email" type="email" autoComplete="email" required />
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
  );
}
