import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export type PageHeaderProps = {
  eyebrow: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
};

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  className,
}: PageHeaderProps) {
  return (
    <header className={cn("mb-10 border-b border-line pb-8", className)}>
      <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
        <div className="max-w-3xl">
          <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-ink-muted">
            {eyebrow}
          </p>
          <h1 className="mt-3 text-[2rem] leading-[1.08] text-ink sm:text-[2.5rem]">
            {title}
          </h1>
          {description ? (
            <p className="mt-3 max-w-2xl text-sm leading-6 text-ink-soft">
              {description}
            </p>
          ) : null}
        </div>
        {actions ? (
          <div className="flex shrink-0 items-center gap-3">{actions}</div>
        ) : null}
      </div>
    </header>
  );
}
