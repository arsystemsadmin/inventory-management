import * as React from "react";
import { cn } from "@/lib/utils";

/** Native <select>: best UX on phones (OS picker), styled to match shadcn inputs. */
function NativeSelect({ className, ...props }: React.ComponentProps<"select">) {
  return (
    <select
      data-slot="native-select"
      className={cn(
        "flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-1 shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}

export { NativeSelect };
