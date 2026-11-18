"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { postJson } from "@/lib/client-upload";

type Mode = "all" | "extract" | "analyze";

export function ProcessActions({
  contentId,
  extractionReady,
  analysisReady,
}: {
  contentId: string;
  extractionReady: boolean;
  analysisReady: boolean;
}) {
  const [pendingMode, setPendingMode] = useState<Mode | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const router = useRouter();
  const busy = pendingMode !== null;

  async function run(mode: Mode) {
    setPendingMode(mode);
    setError(null);
    setMessage(null);

    try {
      if (mode === "all" || mode === "extract") {
        await postJson(`/api/content/${contentId}/extract`);
      }

      if (mode === "all" || mode === "analyze") {
        await postJson(`/api/content/${contentId}/analyze`);
      }

      setMessage(
        mode === "extract"
          ? "Extraction completed."
          : "Analysis completed.",
      );
      router.refresh();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Processing failed.",
      );
    } finally {
      setPendingMode(null);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          onClick={() => run(extractionReady ? "analyze" : "all")}
          disabled={busy}
          size="sm"
        >
          {pendingMode
            ? pendingMode === "extract"
              ? "Extracting…"
              : pendingMode === "analyze"
                ? "Analyzing…"
                : "Extracting and analyzing…"
            : extractionReady
              ? analysisReady
                ? "Re-analyze"
                : "Run analysis"
              : "Extract and analyze"}
        </Button>

        {extractionReady ? (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={busy}
            onClick={() => run("extract")}
          >
            Re-extract
          </Button>
        ) : null}
      </div>

      {error ? (
        <p
          role="alert"
          className="rounded-md border border-danger/20 bg-danger-soft px-3 py-2 text-xs leading-5 text-danger"
        >
          {error}
        </p>
      ) : null}

      {message ? (
        <p className="rounded-md border border-success/20 bg-success-soft px-3 py-2 text-xs leading-5 text-success">
          {message}
        </p>
      ) : null}
    </div>
  );
}
