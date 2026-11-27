import { notFound, redirect } from "next/navigation";
import { colorHref } from "@/lib/product-links";

/** Older links pointed at a single size: send them to that color's page. */
export default async function OldVariationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  redirect(colorHref(id));
}
