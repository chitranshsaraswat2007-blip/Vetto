import { cn } from "@/lib/utils";

export type VettoSymbolProps = {
  className?: string;
  inverted?: boolean;
  animated?: boolean;
  title?: string;
};

export function VettoSymbol({
  className,
  inverted = false,
  animated = false,
  title,
}: VettoSymbolProps) {
  return (
    <svg
      viewBox="0 0 48 48"
      fill="none"
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      className={cn(
        "vetto-symbol shrink-0",
        animated && "vetto-symbol--animated",
        className,
      )}
    >
      {title ? <title>{title}</title> : null}
      <path
        d="M5 7 L14 7 L28 37 L20 37 Z"
        fill="currentColor"
        className="vetto-symbol-ink"
      />
      <path
        d="M43 7 L34 7 L20 37 L28 37 Z"
        fill={inverted ? "#c57b5c" : "#a85c40"}
        className="vetto-symbol-accent"
      />
    </svg>
  );
}
