import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { isDemoMode } from "@/lib/mode";
import { DemoHome } from "@/components/demo/demo-pages";

export default async function Home() {
  if (isDemoMode) return <DemoHome />;
  const profile = await requireProfile();
  redirect(profile.role === "owner" ? "/dashboard" : "/stores");
}
