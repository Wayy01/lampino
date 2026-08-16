import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 cursor-pointer",
  {
    variants: {
      variant: {
        primary:
          "bg-primary text-primary-foreground hover:bg-primary-hover shadow-[0_1px_0_0_rgba(0,0,0,0.04)]",
        ink: "bg-foreground text-background hover:bg-foreground/90",
        outline:
          "border border-foreground/15 text-foreground hover:border-foreground/40 hover:bg-foreground/[0.03]",
        ghost: "text-foreground hover:bg-foreground/[0.05]",
        link: "text-primary underline-offset-4 hover:underline p-0 h-auto",
        /** Muted mono text — "clear filters", "continue shopping". */
        quiet:
          "label-mono text-muted-foreground underline-offset-4 hover:text-foreground hover:underline p-0 h-auto",
        /** Soft accent fill that warms to primary — in-card actions. */
        soft: "bg-accent text-accent-foreground hover:bg-primary hover:text-primary-foreground",
        /** Selected filter pill. */
        chip: "label-mono border border-primary/40 bg-primary/5 text-primary hover:bg-primary/10",
        /** Sits on top of imagery, so it can't use theme colours. */
        overlay: "bg-white/10 text-white hover:bg-white/20",
        /** Bare click target — navbar cart, gallery thumbnails. */
        bare: "",
      },
      size: {
        sm: "h-10 px-4 text-sm rounded-[var(--radius-sm)]",
        md: "h-12 px-6 text-[0.95rem] rounded-[var(--radius-md)]",
        lg: "h-14 px-8 text-base rounded-[var(--radius)]",
        chip: "h-auto px-3 py-1.5 gap-1.5",
        "icon-sm": "h-8 w-8 rounded-full",
        icon: "h-9 w-9 rounded-full",
        "icon-lg": "h-11 w-11 rounded-full",
        "icon-xl": "h-12 w-12 rounded-full",
        none: "",
      },
      /** Fully rounded, overriding whatever radius the size sets. */
      pill: { true: "rounded-full", false: "" },
    },
    defaultVariants: { variant: "primary", size: "md", pill: false },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, pill, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        ref={ref}
        className={cn(buttonVariants({ variant, size, pill, className }))}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";

export { buttonVariants };
