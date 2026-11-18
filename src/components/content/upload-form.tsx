"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { Button, buttonStyles } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/form";
import { postJson, uploadWithProgress } from "@/lib/client-upload";
import { cn } from "@/lib/utils";

type Phase =
  | "idle"
  | "uploading"
  | "extracting"
  | "analyzing"
  | "error";

const steps = ["Upload", "Extract", "Analyze"] as const;

function stepState(step: string, phase: Phase) {
  if (phase === "error") {
    return "pending";
  }

  if (phase === "idle") {
    return "pending";
  }

  const order = ["Upload", "Extract", "Analyze"];
  const currentIndex =
    phase === "uploading" ? 0 : phase === "extracting" ? 1 : 2;
  const stepIndex = order.indexOf(step);

  if (stepIndex < currentIndex) {
    return "done";
  }

  if (stepIndex === currentIndex) {
    return "active";
  }

  return "pending";
}

export function UploadForm({
  brands,
  defaultBrandId,
}: {
  brands: Array<{ id: string; name: string }>;
  defaultBrandId?: string;
}) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [uploadedId, setUploadedId] = useState<string | null>(null);
  const router = useRouter();
  const busy = phase === "uploading" || phase === "extracting" || phase === "analyzing";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    setError(null);
    setProgress(0);
    setUploadedId(null);
    setPhase("uploading");

    try {
      const uploaded = await uploadWithProgress<{
        content: { id: string; title: string | null };
      }>("/api/content", formData, setProgress);

      setUploadedId(uploaded.content.id);
      setPhase("extracting");
      await postJson(`/api/content/${uploaded.content.id}/extract`);

      setPhase("analyzing");
      await postJson(`/api/content/${uploaded.content.id}/analyze`);

      router.push(`/content/${uploaded.content.id}`);
      router.refresh();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "The upload could not be completed.",
      );
      setPhase("error");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error ? (
        <div
          role="alert"
          className="rounded-md border border-danger/20 bg-danger-soft px-4 py-3 text-xs leading-5 text-danger"
        >
          <p>{error}</p>
          {uploadedId ? (
            <Link
              href={`/content/${uploadedId}`}
              className="mt-2 inline-flex font-medium underline underline-offset-2"
            >
              Open the uploaded content to retry processing
            </Link>
          ) : null}
        </div>
      ) : null}

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Brand" htmlFor="brandId">
          <Select
            id="brandId"
            name="brandId"
            required
            defaultValue={defaultBrandId ?? brands[0]?.id ?? ""}
            disabled={busy}
          >
            {brands.map((brand) => (
              <option key={brand.id} value={brand.id}>
                {brand.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field
          label="Title"
          htmlFor="title"
          hint="Optional. Defaults to the file name."
        >
          <Input
            id="title"
            name="title"
            maxLength={160}
            disabled={busy}
            placeholder="Winter Roast campaign poster"
          />
        </Field>
      </div>

      <Field
        label="Content file"
        htmlFor="file"
        hint="PNG, JPEG, WebP, PDF, or DOCX up to 20 MB."
      >
        <input
          id="file"
          name="file"
          type="file"
          required
          disabled={busy}
          accept=".png,.jpg,.jpeg,.webp,.pdf,.docx"
          className="mt-1.5 block w-full rounded-md border border-dashed border-line-strong bg-surface-muted px-3 py-6 text-xs text-ink-soft file:mr-3 file:rounded-md file:border file:border-line-strong file:bg-surface file:px-3 file:py-2 file:text-xs file:font-medium file:text-ink hover:file:bg-surface-muted"
        />
      </Field>

      <div className="rounded-md border border-line bg-surface-muted p-4">
        <ol className="grid gap-3 sm:grid-cols-3">
          {steps.map((step, index) => {
            const state = stepState(step, phase);

            return (
              <li key={step} className="flex items-center gap-2.5">
                <span
                  className={cn(
                    "flex size-6 shrink-0 items-center justify-center rounded-full border text-[10px] font-medium",
                    state === "done" &&
                      "border-success/30 bg-success-soft text-success",
                    state === "active" &&
                      "border-accent/30 bg-accent-soft text-accent-strong",
                    state === "pending" &&
                      "border-line-strong bg-surface text-ink-muted",
                  )}
                >
                  {state === "done" ? "✓" : index + 1}
                </span>
                <div>
                  <p className="text-xs font-medium text-ink">{step}</p>
                  <p className="text-[10px] text-ink-muted">
                    {state === "active"
                      ? phase === "uploading"
                        ? `${progress}% uploaded`
                        : "Working…"
                      : state === "done"
                        ? "Complete"
                        : "Waiting"}
                  </p>
                </div>
              </li>
            );
          })}
        </ol>

        {busy ? (
          <div className="mt-4">
            <div
              role="progressbar"
              aria-label={phase === "uploading" ? "Upload progress" : "Processing progress"}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={phase === "uploading" ? progress : undefined}
              className="h-1.5 overflow-hidden rounded-full bg-surface-strong"
            >
              <div
                className={cn(
                  "h-full rounded-full bg-accent transition-[width]",
                  phase !== "uploading" && "animate-pulse",
                )}
                style={{
                  width: `${phase === "uploading" ? progress : 100}%`,
                }}
              />
            </div>
          </div>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" size="lg" disabled={busy}>
          {busy
            ? phase === "uploading"
              ? "Uploading…"
              : phase === "extracting"
                ? "Extracting…"
                : "Analyzing…"
            : "Upload and analyze"}
        </Button>
        <Link
          href="/content"
          className={buttonStyles({ variant: "secondary", size: "lg" })}
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}
