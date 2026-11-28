"use client";

import { useEffect, useId, useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * A card with a tap-to-collapse header. With `storageKey`, the open/closed
 * choice is remembered on this device.
 */
export function CollapsibleSection({
  title, summary, storageKey, defaultOpen = true, children, className,
}: {
  title: React.ReactNode;
  /** Shown in the header (e.g. a total), handy while collapsed. */
  summary?: React.ReactNode;
  storageKey?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const id = useId();
  useEffect(() => {
    if (!storageKey) return;
    try {
      const v = window.localStorage.getItem(`binventory-section-${storageKey}`);
      if (v !== null) setOpen(v === "1");
    } catch { /* ignore */ }
  }, [storageKey]);
  const toggle = () => {
    setOpen((o) => {
      if (storageKey) { try { window.localStorage.setItem(`binventory-section-${storageKey}`, o ? "0" : "1"); } catch { /* ignore */ } }
      return !o;
    });
  };
  return (
    <section className={cn("min-w-0 rounded-xl border bg-card", className)}>
      <h2>
        <button type="button" onClick={toggle} aria-expanded={open} aria-controls={id}
          className="flex w-full items-center gap-2 px-4 py-3 text-start">
          <span className="shrink-0 font-semibold">{title}</span>
          {summary !== undefined && <span className="ms-auto min-w-0 truncate text-sm text-muted-foreground">{summary}</span>}
          <ChevronDown className={cn("size-5 shrink-0 text-muted-foreground transition-transform", summary === undefined && "ms-auto", open && "rotate-180")} aria-hidden />
        </button>
      </h2>
      {open && <div id={id} className="border-t px-4 py-3">{children}</div>}
    </section>
  );
}
