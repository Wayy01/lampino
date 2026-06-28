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
>(({ className, children, ...props }, ref) => (
  <DialogPrimitive.Portal>
    <DialogPrimitive.Overlay className="cs-dialog-overlay fixed inset-0 z-[80] bg-foreground/40 backdrop-blur-sm" />
    <div className="fixed inset-0 z-[90] flex items-center justify-center overflow-y-auto p-4">
      <DialogPrimitive.Content
        ref={ref}
        className={cn(
          "cs-dialog-content relative my-auto grid w-full max-w-lg gap-6 rounded-[var(--radius-lg)] border border-border bg-surface p-7 shadow-2xl",
          className,
        )}
        {...props}
      >
        {children}
        <DialogPrimitive.Close className="absolute right-5 top-5 rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-foreground/[0.05] hover:text-foreground focus:outline-none cursor-pointer">
          <X className="h-4 w-4" />
          <span className="sr-only">Close</span>
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </div>
  </DialogPrimitive.Portal>
));
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
