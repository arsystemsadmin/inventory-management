import { requireProfile } from "@/lib/auth";
import { loadInventory } from "@/lib/queries";
import { InventoryView } from "@/components/inventory/inventory-view";
import { LiveRefresh } from "@/components/live-refresh";
import { STOCK_STATUSES, type StockStatus } from "@/lib/types";

export const metadata = { title: "Inventory · Binventory" };

export default async function InventoryPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const profile = await requireProfile();
  const { status } = await searchParams;
  const { items, stores } = await loadInventory();
  const initial = status === "ALERTS" || STOCK_STATUSES.includes(status as StockStatus) ? (status as StockStatus | "ALERTS") : undefined;

  return (
    <div className="grid gap-4">
      <h1 className="text-2xl font-semibold">Inventory</h1>
      <InventoryView items={items} stores={stores} role={profile.role} initialStatus={initial} />
      <LiveRefresh tables={["items", "stores"]} />
    </div>
  );
}
