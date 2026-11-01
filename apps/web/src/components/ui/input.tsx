import type { ComponentProps } from "react";
import { cn } from "../../lib/utils";

export function Input({ className, type, ...props }: ComponentProps<"input">) {
  return (
    <input
      type={type}
      className={cn(
        "flex min-h-9 w-full rounded border border-[#EDEEEC] bg-white px-3 py-1.5 text-sm text-[#212121] placeholder:text-[#8E9596] transition-colors focus:border-[#97CAEE] focus:outline-none focus:ring-1 focus:ring-[#97CAEE] disabled:cursor-not-allowed disabled:bg-[#F6F6F6] disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}
