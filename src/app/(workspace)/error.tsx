"use client";

import { RotateCcw } from "lucide-react";
import { useEffect } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export default function WorkspaceError({
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
    <div className="rounded-lg border border-line bg-surface p-8 shadow-card sm:p-10">
      <Badge variant="danger">Workspace error</Badge>
      <h1 className="mt-3 text-3xl text-ink">This page could not be loaded.</h1>
      <p className="mt-3 max-w-xl text-sm leading-6 text-ink-soft">
        The workspace is still running, but this request failed. Try again, and
        check the server logs if the problem continues.
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
  );
}
