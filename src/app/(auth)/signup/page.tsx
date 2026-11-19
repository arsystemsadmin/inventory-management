"use client";

import { useActionState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signup } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { demoSignup } from "@/lib/demo/auth";
import { isDemoMode } from "@/lib/mode";

export default function SignupPage() {
  const router = useRouter();
  const [state, action, pending] = useActionState(
    async (prev: { error?: string; message?: string } | undefined, form: FormData): Promise<{ error?: string; message?: string } | undefined> => {
      if (!isDemoMode) return signup(prev, form);
      const res = await demoSignup(form);
      if (!res.error) router.replace("/app");
      return res;
    },
    undefined,
  );
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
          {isDemoMode && (
            <label className="flex items-start gap-3 rounded-md border p-3 text-sm">
              <Checkbox name="sample" defaultChecked className="mt-0.5" />
              <span>
                <span className="font-medium">Load sample data</span>
                <span className="block text-muted-foreground">3 stores, ~30 items, 2 employees, a week of sales and shifts. Good for a walkthrough.</span>
              </span>
            </label>
          )}
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
