import { cn } from "@/lib/utils";

export type VettoWordmarkProps = {
  className?: string;
  title?: string;
};

export function VettoWordmark({ className, title }: VettoWordmarkProps) {
  return (
    <svg
      viewBox="0 0 158 28"
      fill="none"
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      className={cn("vetto-wordmark block", className)}
    >
      {title ? <title>{title}</title> : null}
      <g
        stroke="currentColor"
        strokeWidth="3.3"
        strokeLinecap="butt"
        strokeLinejoin="miter"
      >
        <path d="M1.8 2.6 L13 25.4 L24.2 2.6" />
        <path d="M57.5 2.6 H37.5 V25.4 H57.5 M37.5 14 H51" />
        <path d="M67.5 2.6 H89.5 M78.5 2.6 V25.4" />
        <path d="M99.5 2.6 H121.5 M110.5 2.6 V25.4" />
        <circle cx="145" cy="14" r="10.2" />
      </g>
    </svg>
  );
}
