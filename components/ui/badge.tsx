import { cn } from "@/lib/cn";
import type { HTMLAttributes } from "react";

type Variant = "default" | "accent" | "success" | "danger";

// Badges are quiet, hairline-outlined labels — no filled color blocks.
// The "accent" variant is the gold eyebrow label (small text uses the AA-safe gold).
const variants: Record<Variant, string> = {
  default: "border border-border text-secondary",
  accent: "border border-transparent px-0 tracking-[0.2em] text-accent-strong",
  success: "border border-border text-success",
  danger: "border border-border text-danger",
};

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: Variant;
}

export function Badge({ variant = "default", className, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-wider",
        variants[variant],
        className
      )}
      {...props}
    />
  );
}
