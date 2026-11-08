"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;

export const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, ...props }, ref) => {
  // Content covers the viewport (see below), so Radix's own outside-pointer
  // dismissal can never fire — backdrop clicks land *inside* Content. Recreate
  // it: a pointerdown that starts on the padding layer itself (not the card)
  // triggers the hidden Close. Pointerdown, not click, so a text-selection drag
  // that ends on the backdrop doesn't dismiss.
  const closeRef = React.useRef<HTMLButtonElement>(null);
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="cs-dialog-overlay fixed inset-0 z-[80] bg-foreground/40 backdrop-blur-sm" />
      {/* The Content node is both what Radix's scroll-lock whitelists and what it
          watches for the exit animation, so it IS the full-screen scroll layer;
          the visible card is centered inside it and scrolls as one block. */}
      <DialogPrimitive.Content
        ref={ref}
        className="cs-dialog-scroll fixed inset-0 z-[90] overflow-y-auto focus:outline-none"
        {...props}
      >
        <div
          className="flex min-h-full items-center justify-center p-4"
          onPointerDown={(e) => {
            if (e.target === e.currentTarget) closeRef.current?.click();
          }}
        >
          <div
            className={cn(
              "cs-dialog-content relative my-8 grid w-full max-w-lg gap-6 rounded-[var(--radius-lg)] border border-border bg-surface p-7 shadow-2xl",
              className,
            )}
          >
            {children}
            <DialogPrimitive.Close className="absolute right-5 top-5 rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-foreground/[0.05] hover:text-foreground focus:outline-none cursor-pointer">
              <X className="h-4 w-4" />
              <span className="sr-only">Close</span>
            </DialogPrimitive.Close>
            <DialogPrimitive.Close ref={closeRef} className="hidden" aria-hidden tabIndex={-1} />
          </div>
        </div>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
});
DialogContent.displayName = "DialogContent";

export function DialogTitle({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      className={cn("font-display text-2xl tracking-tight", className)}
      {...props}
    />
  );
}

export function DialogDescription({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  );
}
