import type { HTMLAttributes } from "react";

import { cn } from "@/lib/utils";

type BadgeVariant =
  | "neutral"
  | "accent"
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "outline";

const variantStyles: Record<BadgeVariant, string> = {
  neutral: "border-line bg-surface-strong text-ink-soft",
  accent: "border-accent/20 bg-accent-soft text-accent-strong",
  success: "border-success/20 bg-success-soft text-success",
  warning: "border-warning/20 bg-warning-soft text-warning",
  danger: "border-danger/20 bg-danger-soft text-danger",
  info: "border-info/20 bg-info-soft text-info",
  outline: "border-line-strong bg-transparent text-ink-soft",
};

export type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  variant?: BadgeVariant;
};

export function Badge({ className, variant = "neutral", ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-[11px] font-medium tracking-wide",
        variantStyles[variant],
        className,
      )}
      {...props}
    />
  );
}
