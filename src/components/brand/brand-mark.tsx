import Link from "next/link";

import { VettoSymbol } from "@/components/brand/vetto-symbol";
import { VettoWordmark } from "@/components/brand/vetto-wordmark";
import { cn } from "@/lib/utils";

export type BrandMarkProps = {
  className?: string;
  href?: string;
  inverted?: boolean;
  showTagline?: boolean;
};

export function BrandMark({
  className,
  href = "/dashboard",
  inverted = false,
  showTagline = true,
}: BrandMarkProps) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex items-center gap-2.5 rounded-sm",
        inverted ? "text-surface" : "text-ink",
        className,
      )}
      aria-label="VETTO dashboard"
    >
      <VettoSymbol inverted={inverted} className="size-8" />
      <span className="flex flex-col gap-1">
        <VettoWordmark className="h-[12px] w-auto" />
        {showTagline ? (
          <span
            className={cn(
              "text-[9px] uppercase leading-none tracking-[0.18em]",
              inverted ? "text-surface/55" : "text-ink-muted",
            )}
          >
            Brand intelligence
          </span>
        ) : null}
      </span>
    </Link>
  );
}
