import { requireProfile } from "@/lib/auth";
import { isDemoMode } from "@/lib/mode";
import { loadInventory } from "@/lib/queries";
import { DemoQuickSetupPage } from "@/components/demo/demo-pages";
import { QuickSetupView } from "@/components/inventory/quick-setup-view";
import { getT } from "@/i18n/server";

export async function generateMetadata() {
  const t = await getT();
  return { title: `${t("bulk.title")} · Binventory` };
}

export default async function QuickSetupPage() {
  if (isDemoMode) return <DemoQuickSetupPage />;
  await requireProfile();
  const { items, stores } = await loadInventory();
  const categories = Array.from(new Set(items.map((i) => i.category).filter(Boolean) as string[])).sort();
  return <QuickSetupView stores={stores} categories={categories} />;
}
