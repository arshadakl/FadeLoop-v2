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
          "bg-[#97CAEE] text-[#0E3B57] hover:bg-[#81BEE7] active:bg-[#72B3DE]",
        outline:
          "border border-[#EDEEEC] bg-white text-[#212121] hover:bg-[#F0F0EF] active:bg-[#EAEAEA]",
        secondary:
          "bg-[#E5E5E4] text-[#212121] hover:bg-[#DADAD9] active:bg-[#CFCFCE]",
        ghost: "text-[#5D686A] hover:text-[#212121] hover:bg-[#F0F0EF]",
        destructive:
          "bg-[#FEF2F2] border border-[#FECACA] text-[#B91C1C] hover:bg-[#FEE2E2]",
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
