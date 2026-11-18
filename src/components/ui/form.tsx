import type {
  InputHTMLAttributes,
  LabelHTMLAttributes,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export const controlClassName =
  "mt-1.5 w-full rounded-md border border-line-strong bg-surface px-3 text-sm text-ink shadow-sm transition-colors placeholder:text-ink-muted hover:border-ink-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/15 disabled:cursor-not-allowed disabled:bg-surface-muted disabled:text-ink-muted";

export function Label({
  className,
  ...props
}: LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={cn("block text-xs font-medium text-ink-soft", className)}
      {...props}
    />
  );
}

export function Input({
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(controlClassName, "h-10", className)}
      {...props}
    />
  );
}

export function Textarea({
  className,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(controlClassName, "min-h-24 py-2.5", className)}
      {...props}
    />
  );
}

export function Select({
  className,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(controlClassName, "h-10", className)}
      {...props}
    />
  );
}

export function Field({
  label,
  htmlFor,
  hint,
  children,
  className,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {hint ? (
        <p className="mt-1.5 text-[11px] leading-5 text-ink-muted">{hint}</p>
      ) : null}
    </div>
  );
}
