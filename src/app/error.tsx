"use client";

import Link from "next/link";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";

/** Friendly fallback instead of Next's raw "Application error" page. */
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error(error); }, [error]);
  return (
    <main className="mx-auto grid min-h-[60dvh] max-w-md place-items-center px-4 text-center">
      <div className="grid gap-3">
        <h1 className="text-xl font-semibold">Something went wrong</h1>
        <p className="text-sm text-muted-foreground">
          That didn&apos;t work. Your data is safe. Try again, or go back to the app.
        </p>
        {error.digest && <p className="text-xs text-muted-foreground">Error code: {error.digest}</p>}
        <div className="flex justify-center gap-2">
          <Button onClick={reset}>Try again</Button>
          <Button variant="outline" asChild><Link href="/app">Back to the app</Link></Button>
        </div>
      </div>
    </main>
  );
}
