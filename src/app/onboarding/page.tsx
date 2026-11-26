import { requireOwner } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { isDemoMode } from "@/lib/mode";
import { getT } from "@/i18n/server";
import { OnboardingFlow } from "@/components/onboarding/onboarding-flow";
import { DemoOnboarding } from "@/components/onboarding/demo-onboarding";

export async function generateMetadata() {
  const t = await getT();
  return { title: `${t("onboarding.step1")} · Binventory` };
}

/** First sign-in for an owner: set up the first store (the app redirects here until one exists). */
export default async function OnboardingPage() {
  if (isDemoMode) return <DemoOnboarding />;
  const owner = await requireOwner();
  const supabase = await createClient();
  const { data: business } = await supabase.from("businesses").select("name").single();
  return <OnboardingFlow ownerName={owner.full_name} businessName={business?.name ?? "Binventory"} />;
}
