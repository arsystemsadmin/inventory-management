"use client";

import { useActionState } from "react";
import Link from "next/link";
import { signup } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function SignupPage() {
  const [state, action, pending] = useActionState(signup, undefined);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Create your business</CardTitle>
        <CardDescription>You&apos;ll be the owner. Add employees after signing in.</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={action} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="business_name">Business name</Label>
            <Input id="business_name" name="business_name" required maxLength={200} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="full_name">Your name</Label>
            <Input id="full_name" name="full_name" autoComplete="name" required maxLength={200} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" autoComplete="email" required />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="password">Password</Label>
            <Input id="password" name="password" type="password" autoComplete="new-password" minLength={8} required />
          </div>
          {state?.error && <p className="text-sm text-destructive" role="alert">{state.error}</p>}
          {state?.message && <p className="text-sm text-emerald-700">{state.message}</p>}
          <Button type="submit" size="lg" disabled={pending}>{pending ? "Creating…" : "Create account"}</Button>
          <p className="text-sm text-muted-foreground text-center">
            Already have an account? <Link href="/login" className="underline">Sign in</Link>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
