"use client";
import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { XIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const Dialog = DialogPrimitive.Root;
const DialogTrigger = DialogPrimitive.Trigger;
const DialogClose = DialogPrimitive.Close;

function DialogContent({
  className,
  children,
  onOpenAutoFocus,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content>) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
      <DialogPrimitive.Content
        data-slot="dialog-content"
        className={cn(
          // Bottom sheet on phones, centered dialog from sm up.
          // Height: 85% of the *smallest* viewport (svh = with Safari's toolbars shown), so a
          // sheet always fits and scrolls inside itself instead of running off the screen.
          "fixed z-50 grid w-full gap-4 border bg-background p-5 shadow-lg duration-200 overflow-y-auto overscroll-contain",
          "max-h-[85vh] supports-[height:100svh]:max-h-[85svh]",
          "inset-x-0 bottom-0 rounded-t-2xl data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:slide-in-from-bottom data-[state=closed]:slide-out-to-bottom",
          "sm:inset-auto sm:top-1/2 sm:left-1/2 sm:max-w-lg sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-xl sm:data-[state=open]:slide-in-from-bottom-0 sm:data-[state=open]:zoom-in-95",
          "pb-[max(1.25rem,env(safe-area-inset-bottom))]",
          className,
        )}
        // Phones: don't focus the first field on open. On iPhone that pops the keyboard,
        // which resizes the screen and can leave the sheet pushed half off the bottom.
        onOpenAutoFocus={(e) => {
          onOpenAutoFocus?.(e);
          if (!e.defaultPrevented && typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches) {
            e.preventDefault();
          }
        }}
        {...props}
      >
        {children}
        <DialogPrimitive.Close className="absolute top-4 end-4 rounded-xs opacity-70 transition-opacity hover:opacity-100 p-1">
          <XIcon className="size-5" />
          <span className="sr-only">Close</span>
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}
function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("flex flex-col gap-1.5 text-start pe-8", className)} {...props} />;
}
function DialogFooter({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("flex flex-col-reverse gap-2 sm:flex-row sm:justify-end", className)} {...props} />;
}
function DialogTitle({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return <DialogPrimitive.Title className={cn("text-lg leading-none font-semibold", className)} {...props} />;
}
function DialogDescription({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return <DialogPrimitive.Description className={cn("text-muted-foreground text-sm", className)} {...props} />;
}

export { Dialog, DialogTrigger, DialogClose, DialogContent, DialogHeader, DialogFooter, DialogTitle, DialogDescription };
