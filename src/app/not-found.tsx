import type { Metadata } from "next";
import Link from "next/link";

import { BrandMark } from "@/components/brand/brand-mark";
import { buttonStyles } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Page not found",
};

export default function NotFound() {
  return (
    <main className="flex flex-1 items-center justify-center px-5 py-16 sm:px-8">
      <div className="w-full max-w-xl rounded-lg border border-line bg-surface p-8 shadow-raised sm:p-10">
        <BrandMark />
        <div className="mt-10 flex items-baseline gap-3">
          <span className="font-display text-5xl leading-none text-accent">
            404
          </span>
          <span className="text-[10px] font-medium uppercase tracking-[0.2em] text-ink-muted">
            Page not found
          </span>
        </div>
        <h1 className="mt-4 text-3xl text-ink">This page does not exist.</h1>
        <p className="mt-3 text-sm leading-6 text-ink-soft">
          The link may be outdated, or the workspace route may have moved. The
          content and brand records themselves are unchanged.
        </p>
        <Link href="/dashboard" className={buttonStyles({ className: "mt-6" })}>
          Back to dashboard
        </Link>
      </div>
    </main>
  );
}
