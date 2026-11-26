"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { isDemoMode } from "@/lib/mode";
import { currentUser } from "@/lib/demo/logic";
import { getState, getUserId } from "@/lib/demo/store";

/** Browser demo: sign-in lives in this browser, so the landing page redirects signed-in users here. */
export function DemoLandingRedirect() {
  const router = useRouter();
  useEffect(() => {
    if (!isDemoMode) return;
    try {
      if (currentUser(getState(), getUserId())) router.replace("/app");
    } catch { /* storage unavailable: stay on the landing page */ }
  }, [router]);
  return null;
}
