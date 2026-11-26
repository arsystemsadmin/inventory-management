"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { ActionsProvider } from "@/lib/actions-context";
import { demoActions } from "@/lib/demo/actions";
import { currentUser, isOwner } from "@/lib/demo/logic";
import { useDemo } from "@/lib/demo/store";
import { DemoLoading } from "@/components/demo/demo-shell";
import { OnboardingFlow } from "./onboarding-flow";

/** Browser demo version: session and data come from this browser. */
export function DemoOnboarding() {
  const snap = useDemo();
  const router = useRouter();
  const user = snap ? currentUser(snap.state, snap.userId) : null;
  useEffect(() => {
    if (!snap) return;
    if (!user) router.replace("/login?next=/onboarding");
    else if (!isOwner(user)) router.replace("/app");
  }, [snap, user, router]);
  if (!snap || !user || !isOwner(user)) return <DemoLoading />;
  const business = snap.state.businesses.find((b) => b.id === user.business_id);
  return (
    <ActionsProvider value={demoActions}>
      <OnboardingFlow ownerName={user.full_name} businessName={business?.name ?? "Binventory"} />
    </ActionsProvider>
  );
}
