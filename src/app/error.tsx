"use client";

import { RotateCcw } from "lucide-react";
import { useEffect } from "react";

import { BrandMark } from "@/components/brand/brand-mark";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flex flex-1 items-center justify-center px-5 py-16 sm:px-8">
      <div className="w-full max-w-xl rounded-lg border border-line bg-surface p-8 shadow-raised sm:p-10">
        <BrandMark />
        <Badge variant="danger" className="mt-8">
          Unable to load
        </Badge>
        <h1 className="mt-3 text-3xl text-ink">Something went wrong.</h1>
        <p className="mt-3 text-sm leading-6 text-ink-soft">
          The request could not be completed. Try again, and check the server
          logs if the problem continues.
        </p>
        {error.digest ? (
          <p className="mt-4 text-[11px] text-ink-muted">
            Reference: {error.digest}
          </p>
        ) : null}
        <Button onClick={reset} className="mt-6">
          <RotateCcw aria-hidden="true" className="size-4" />
          Try again
        </Button>
      </div>
    </main>
  );
}
