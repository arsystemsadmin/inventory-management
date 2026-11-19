import { Shirt } from "lucide-react";
import { cn } from "@/lib/utils";
import { itemImageUrl } from "@/lib/item-images";

/** Item photo, or a neutral placeholder so rows stay aligned. */
export function ItemThumb({ path, alt, className }: { path: string | null | undefined; alt: string; className?: string }) {
  const url = itemImageUrl(path);
  return (
    <div className={cn("grid shrink-0 place-items-center overflow-hidden rounded-lg border bg-muted", className ?? "size-12")}>
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element -- user photos; no image optimizer on Workers
        <img src={url} alt={alt} loading="lazy" className="size-full object-cover" />
      ) : (
        <Shirt className="size-5 text-muted-foreground/60" aria-hidden />
      )}
    </div>
  );
}
