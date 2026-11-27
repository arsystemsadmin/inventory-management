import { notFound } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { isDemoMode } from "@/lib/mode";
import { loadProductDetail } from "@/lib/queries";
import { LiveRefresh } from "@/components/live-refresh";
import { DemoColorPage } from "@/components/demo/demo-pages";
import { ColorDetailView } from "@/components/views/product-detail-views";
import { getT } from "@/i18n/server";

export async function generateMetadata() {
  const t = await getT();
  return { title: `${t("nav.inventory")} · Binventory` };
}

/** Loaded fresh every time it's opened; RLS limits it to stores you can access. */
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  if (isDemoMode) return <DemoColorPage id={id} />;
  const profile = await requireProfile();
  const detail = await loadProductDetail(id);
  if (!detail) notFound();
  return (
    <>
      <ColorDetailView {...detail} role={profile.role} />
      <LiveRefresh tables={["items", "sales"]} />
    </>
  );
}
