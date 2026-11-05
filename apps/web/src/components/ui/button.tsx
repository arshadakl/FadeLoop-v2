import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";
import { cn } from "../../lib/utils";

const buttonVariants = cva(
  "inline-flex min-h-9 items-center justify-center gap-2 rounded px-3.5 py-1.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 select-none",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground hover:bg-primary-hover active:opacity-90",
        outline:
          "border border-border bg-card text-foreground hover:bg-muted active:opacity-90",
        secondary:
          "bg-muted text-foreground hover:bg-muted/80 active:opacity-90",
        ghost: "text-muted-foreground hover:text-foreground hover:bg-muted",
        destructive:
          "bg-destructive/10 border border-destructive/30 text-destructive hover:bg-destructive/20",
      },
      size: {
        default: "min-h-9 px-3.5 py-1.5 text-sm",
        sm: "min-h-7 px-2.5 py-1 text-xs rounded-sm",
        lg: "min-h-11 px-5 py-2.5 text-base",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

export function Button({
  className,
  variant,
  size,
  asChild = false,
  type = "button",
  ...props
}: ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
  const Component = asChild ? Slot : "button";
  return (
    <Component
      {...(!asChild ? { type } : {})}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}
