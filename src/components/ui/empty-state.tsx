import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export type EmptyStateProps = {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: ReactNode;
  className?: string;
};

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-lg border border-dashed border-line-strong bg-surface/60 px-6 py-16 text-center",
        className,
      )}
    >
      <div className="flex size-12 items-center justify-center rounded-md border border-line bg-surface text-ink-muted shadow-card">
        <Icon aria-hidden="true" className="size-5" strokeWidth={1.5} />
      </div>
      <h2 className="mt-5 font-display text-xl text-ink">{title}</h2>
      <p className="mt-2 max-w-md text-sm leading-6 text-ink-soft">
        {description}
      </p>
      {action ? <div className="mt-6">{action}</div> : null}
    </div>
  );
}
