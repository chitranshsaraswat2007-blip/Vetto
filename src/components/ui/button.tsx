import type { ButtonHTMLAttributes } from "react";

import { cn } from "@/lib/utils";

type ButtonVariant = "primary" | "secondary" | "ghost" | "accent";
type ButtonSize = "sm" | "md" | "lg";

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    "bg-ink text-white shadow-card hover:bg-ink-hover active:bg-ink",
  secondary:
    "border border-line-strong bg-surface text-ink hover:border-ink-muted hover:bg-surface-muted",
  ghost: "text-ink-soft hover:bg-surface hover:text-ink",
  accent: "bg-accent text-white hover:bg-accent-strong",
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-xs",
  md: "h-10 px-4 text-sm",
  lg: "h-11 px-5 text-sm",
};

export function buttonStyles({
  variant = "primary",
  size = "md",
  className,
}: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
} = {}) {
  return cn(
    "inline-flex items-center justify-center gap-2 rounded-md font-medium transition-colors duration-150 disabled:pointer-events-none disabled:opacity-50",
    variantStyles[variant],
    sizeStyles[size],
    className,
  );
}

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
};

export function Button({
  className,
  variant = "primary",
  size = "md",
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={buttonStyles({ variant, size, className })}
      {...props}
    />
  );
}
