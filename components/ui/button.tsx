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
      },
      size: {
        sm: "h-10 px-4 text-sm rounded-[var(--radius-sm)]",
        md: "h-12 px-6 text-[0.95rem] rounded-[var(--radius-md)]",
        lg: "h-14 px-8 text-base rounded-[var(--radius)]",
        icon: "h-11 w-11 rounded-full",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        ref={ref}
        className={cn(buttonVariants({ variant, size, className }))}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";

export { buttonVariants };
