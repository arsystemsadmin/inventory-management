"use client";
import * as React from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

/** Lightweight shadcn-style checkbox (native input, accessible, large tap target via label). */
function Checkbox({
  className, checked, onCheckedChange, ...props
}: Omit<React.ComponentProps<"input">, "type" | "onChange"> & { onCheckedChange?: (checked: boolean) => void }) {
  return (
    <span className={cn("relative inline-flex size-5 shrink-0", className)}>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onCheckedChange?.(e.target.checked)}
        className="peer size-5 appearance-none rounded border border-input bg-background checked:border-primary checked:bg-primary focus-visible:ring-[3px] focus-visible:ring-ring/50"
        {...props}
      />
      <Check className="pointer-events-none absolute inset-0 m-auto size-3.5 text-primary-foreground opacity-0 peer-checked:opacity-100" />
    </span>
  );
}

export { Checkbox };
