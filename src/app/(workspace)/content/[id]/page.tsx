import { ArrowLeft, Download, FileType } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { ProcessActions } from "@/components/content/process-actions";
import {
  FindingStatusForm,
  AssignSupervisorReviewForm,
  ReviewCommentForm,
  ReviewDecisionForm,
  ResolveSupervisorEscalationForm,
  SubmitForReviewForm,
  SupervisorEscalationForm,
} from "@/components/reviews/review-forms";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { requireUser } from "@/lib/auth/guards";
import { getCurrentUser } from "@/lib/auth/session";
import { hasPermission, roleLabels } from "@/lib/auth/permissions";
import { canProcessContent, canViewContent } from "@/lib/content/access";
import {
  CONTENT_KIND_LABELS,
  CONTENT_STATUS_LABELS,
  CONTENT_STATUS_VARIANTS,
} from "@/lib/content/constants";
import {
  ruleCategoryLabels,
  severityDecisionBuckets,
  severityDecisionDescriptions,
  severityDecisionLabel,
} from "@/lib/brands/labels";
import { db } from "@/lib/db";
import type { ExtractionData } from "@/lib/extraction/types";
import {
  findingStatusLabels,
  findingStatusVariants,
  reviewActionLabels,
} from "@/lib/reviews/types";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const user = await getCurrentUser();

  if (!user) {
    return { title: "Content" };
  }

  const content = await db.content.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      originalFilename: true,
      uploadedById: true,
    },
  });

  if (!content || !(await canViewContent(user, content))) {
    return { title: "Content" };
  }

  return {
    title: content.title ?? content.originalFilename ?? "Content",
  };
}

function severityVariant(severity: string) {
  if (severity === "CRITICAL" || severity === "HIGH") {
    return "danger" as const;
  }

  if (severity === "MEDIUM") {
    return "warning" as const;
  }

  if (severity === "LOW") {
    return "info" as const;
  }

  return "neutral" as const;
}

function scoreTone(score: number) {
  if (score >= 85) {
    return "text-success";
  }

  if (score >= 70) {
    return "text-warning";
  }

  return "text-danger";
}

function ScoreRow({
  label,
  score,
  unavailableReason,
}: {
  label: string;
  score: number | null;
  unavailableReason: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-line py-2.5 last:border-b-0 last:pb-0 first:pt-0">
      <span className="text-xs text-ink-soft">{label}</span>
      {score === null ? (
        <span
          className="text-[11px] text-ink-muted"
          title={unavailableReason}
        >
          Not scored
        </span>
      ) : (
        <span className={`text-sm font-medium ${scoreTone(score)}`}>
          {score}
          <span className="text-[10px] font-normal text-ink-muted"> / 100</span>
        </span>
      )}
    </div>
  );
}

const dateFormatter = new Intl.DateTimeFormat("en", {
  dateStyle: "medium",
  timeStyle: "short",
});

type AnalysisMeta = {
  limitations?: unknown;
  fontMatch?: {
    status?: "matched" | "mismatch" | "unavailable" | "not-configured";
    observed?: string[];
    approved?: string[];
  };
  ai?: {
    status?: string;
    summary?: string | null;
    error?: string | null;
    model?: string | null;
    brandVibeRationale?: string | null;
    brandVibeEvidence?: {
      quote?: string;
      ruleName?: string;
    } | null;
  } | null;
};

export default async function ContentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;

  const content = await db.content.findUnique({
    where: { id },
    include: {
      brand: { select: { id: true, name: true, slug: true } },
      uploadedBy: { select: { name: true } },
      extraction: true,
      reviews: {
        orderBy: { createdAt: "asc" },
        include: {
          actor: { select: { name: true, role: true } },
        },
      },
      supervisorAssignment: {
        include: { supervisor: { select: { id: true, name: true } }, assignedBy: { select: { name: true } } },
      },
      supervisorEscalations: {
        orderBy: { createdAt: "desc" },
        include: {
          supervisor: { select: { id: true, name: true } },
          raisedBy: { select: { name: true } },
          resolvedBy: { select: { name: true } },
        },
      },
      analysisRuns: {
        orderBy: { createdAt: "desc" },
        take: 5,
        include: {
          findings: {
            orderBy: { severity: "asc" },
            include: { rule: { select: { name: true } } },
          },
        },
      },
    },
  });

  if (!content) {
    redirect("/forbidden");
  }

  if (!(await canViewContent(user, content))) {
    redirect("/forbidden");
  }

  const canProcess = canProcessContent(user, content);
  const canReview = hasPermission(user.role, "content:review");
  const canAssignSupervisor = user.role === "MANAGER" && hasPermission(user.role, "review:assign");
  const canEscalate = user.role === "MANAGER" && content.status === "SUBMITTED";
  const openEscalation = content.supervisorEscalations.find(
    (escalation) => escalation.status === "OPEN",
  );
  const isAssignedEscalation =
    user.role === "SUPERVISOR" &&
    openEscalation?.supervisorId === user.id &&
    content.status === "SUBMITTED";
  const supervisorReviewAssigned =
    user.role === "SUPERVISOR" &&
    content.supervisorAssignment?.supervisorId === user.id &&
    content.status === "APPROVED";
  const canSubmitReview =
    hasPermission(user.role, "content:submit") &&
    (content.uploadedById === user.id ||
      hasPermission(user.role, "settings:manage"));
  const canUpdateFindings = hasPermission(user.role, "finding:update");
  const locked =
    content.status === "SUBMITTED" || content.status === "APPROVED";
  const latestRun = content.analysisRuns[0] ?? null;
  const latestReview = content.reviews[content.reviews.length - 1] ?? null;
  const needsReview =
    content.status === "REVIEW_READY" ||
    content.status === "CHANGES_REQUESTED";
  const extractionData = (content.extraction?.data ??
    null) as ExtractionData | null;
  const analysisMeta = (latestRun?.metadata ?? null) as AnalysisMeta | null;
  const limitations = Array.isArray(analysisMeta?.limitations)
    ? analysisMeta.limitations.filter(
        (value): value is string => typeof value === "string",
      )
    : [];
  const ai = analysisMeta?.ai ?? null;
  const title = content.title ?? content.originalFilename;
  const extractionReady = content.extraction?.status === "COMPLETED";
  const analysisReady = latestRun?.status === "COMPLETED";
  const fileUrl = `/api/content/${content.id}/file`;
  const supervisors = canAssignSupervisor || canEscalate
    ? await db.user.findMany({
        where: { role: "SUPERVISOR", isActive: true },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      })
    : [];

  return (
    <>
      <PageHeader
        eyebrow="Content review"
        title={title}
        description={`Uploaded by ${content.uploadedBy.name} on ${dateFormatter.format(
          content.createdAt,
        )} · ${content.brand.name}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/content"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-ink-soft hover:text-ink"
            >
              <ArrowLeft
                aria-hidden="true"
                className="size-3.5"
                strokeWidth={1.75}
              />
              All content
            </Link>
            <Badge variant="outline">
              {CONTENT_KIND_LABELS[content.kind] ?? content.kind}
            </Badge>
            <Badge
              variant={CONTENT_STATUS_VARIANTS[content.status] ?? "neutral"}
            >
              {CONTENT_STATUS_LABELS[content.status] ?? content.status}
            </Badge>
          </div>
        }
      />

      {canProcess ? (
        <Card className="mb-6">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Processing</CardTitle>
            <CardDescription>
              {locked
                ? "This content is locked by its review state. Processing is disabled until the review changes."
                : "Re-run extraction or deterministic analysis. AI review is used only when configured."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {locked ? (
              <p className="text-xs text-ink-muted">
                Current state: {CONTENT_STATUS_LABELS[content.status]}.
              </p>
            ) : (
              <ProcessActions
                contentId={content.id}
                extractionReady={extractionReady}
                analysisReady={analysisReady}
              />
            )}
          </CardContent>
        </Card>
      ) : null}

      <Card className="mb-6">
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="text-base">Review</CardTitle>
              <CardDescription>
                A human decision is required. Submission, approvals, change
                requests, and comments are recorded against this content.
              </CardDescription>
            </div>
            <Badge
              variant={CONTENT_STATUS_VARIANTS[content.status] ?? "neutral"}
            >
              {CONTENT_STATUS_LABELS[content.status] ?? content.status}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {latestReview &&
          (latestReview.action === "CHANGES_REQUESTED" ||
            latestReview.action === "APPROVED") ? (
            <blockquote className="rounded-md border border-line bg-surface-muted px-4 py-3">
              <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-ink-muted">
                {reviewActionLabels[latestReview.action]} by{" "}
                {latestReview.actor.name}
              </p>
              <p className="mt-1.5 text-xs leading-6 text-ink-soft">
                {latestReview.comment || "No note was provided."}
              </p>
            </blockquote>
          ) : null}

          {content.status === "SUBMITTED" ? (
            openEscalation ? (
              isAssignedEscalation ? (
                <ResolveSupervisorEscalationForm
                  escalationId={openEscalation.id}
                  question={openEscalation.question}
                />
              ) : (
                <p className="rounded-md border border-warning/20 bg-warning-soft px-4 py-3 text-xs leading-5 text-warning">
                  Waiting for {openEscalation.supervisor.name} to assess the question. The Manager decision is paused until they respond.
                </p>
              )
            ) : canReview ? (
              <div className="space-y-4">
                <ReviewDecisionForm contentId={content.id} />
                {canEscalate ? (
                  <SupervisorEscalationForm contentId={content.id} supervisors={supervisors} />
                ) : null}
              </div>
            ) : (
              <p className="rounded-md border border-line bg-surface-muted px-4 py-3 text-xs leading-5 text-ink-soft">
                This content is waiting for a manager decision. It is locked
                from further processing until the review is complete.
              </p>
            )
          ) : content.status === "APPROVED" ? (
            <div className="space-y-3">
              <p className="rounded-md border border-success/20 bg-success-soft px-4 py-3 text-xs leading-5 text-success">
                Approved{latestReview ? ` by ${latestReview.actor.name}` : ""}. This content is locked from further processing.
              </p>
              {canAssignSupervisor ? (
                <div className="rounded-md border border-line bg-surface-muted p-4">
                  <p className="mb-3 text-xs text-ink-soft">{content.supervisorAssignment ? `Assigned to ${content.supervisorAssignment.supervisor.name} by ${content.supervisorAssignment.assignedBy.name}.` : "Assign this approved review to a Supervisor for a secondary review."}</p>
                  <AssignSupervisorReviewForm
                    contentId={content.id}
                    assignedSupervisorId={content.supervisorAssignment?.supervisorId}
                    supervisors={supervisors}
                  />
                </div>
              ) : supervisorReviewAssigned ? (
                <div className="rounded-md border border-accent/20 bg-accent-soft p-4">
                  <p className="mb-3 text-xs font-medium text-ink">Manager-approved secondary review</p>
                  <ReviewCommentForm contentId={content.id} label="Record secondary review" placeholder="Add your independent review of the manager-approved decision." submitLabel="Submit review" />
                </div>
              ) : null}
            </div>
          ) : needsReview ? (
            canSubmitReview ? (
              <div className="space-y-3">
                <p className="text-xs leading-5 text-ink-soft">
                  {content.status === "CHANGES_REQUESTED"
                    ? "Changes were requested. Update the source or re-run analysis if needed, then resubmit for another decision."
                    : "Analysis is complete. Submit this content when you are ready for a manager decision."}
                </p>
                <SubmitForReviewForm
                  contentId={content.id}
                  resubmission={content.status === "CHANGES_REQUESTED"}
                />
              </div>
            ) : (
              <p className="rounded-md border border-line bg-surface-muted px-4 py-3 text-xs leading-5 text-ink-soft">
                {content.status === "CHANGES_REQUESTED"
                  ? "Waiting for the creator to resubmit after addressing the requested changes."
                  : "The creator can submit this content for review once they are satisfied with the analysis."}
              </p>
            )
          ) : (
            <p className="rounded-md border border-line bg-surface-muted px-4 py-3 text-xs leading-5 text-ink-soft">
              Complete extraction and analysis before submitting this content
              for review.
            </p>
          )}

          {content.reviews.length > 0 && user.role !== "SUPERVISOR" ? (
            <div className="border-t border-line pt-4">
              <p className="mb-2 text-[10px] font-medium uppercase tracking-[0.16em] text-ink-muted">
                Add to the review history
              </p>
              <ReviewCommentForm contentId={content.id} />
            </div>
          ) : null}
        </CardContent>
      </Card>

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Source file</CardTitle>
              <CardDescription>
                {content.originalFilename} ·{" "}
                {(content.fileSize / 1024 / 1024).toFixed(2)} MB ·{" "}
                {content.mimeType}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {content.kind === "IMAGE" ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={fileUrl}
                  alt={title}
                  className="max-h-[640px] w-full rounded-md border border-line bg-surface-muted object-contain"
                />
              ) : content.kind === "PDF" ? (
                <iframe
                  src={fileUrl}
                  title={`PDF preview of ${title}`}
                  className="h-[640px] w-full rounded-md border border-line bg-surface"
                />
              ) : (
                <div className="flex flex-col items-center justify-center rounded-md border border-dashed border-line-strong bg-surface-muted px-6 py-14 text-center">
                  <FileType
                    aria-hidden="true"
                    className="size-8 text-ink-muted"
                    strokeWidth={1.5}
                  />
                  <p className="mt-3 text-sm font-medium text-ink">
                    Document preview is not available in the browser
                  </p>
                  <p className="mt-1 max-w-sm text-xs leading-5 text-ink-muted">
                    Extracted text from this file is shown below. Download the
                    original to inspect formatting.
                  </p>
                </div>
              )}

              <a
                href={fileUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-4 inline-flex items-center gap-1.5 text-xs font-medium text-accent hover:text-accent-strong"
              >
                <Download
                  aria-hidden="true"
                  className="size-3.5"
                  strokeWidth={1.75}
                />
                Open original file
              </a>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Extraction</CardTitle>
              <CardDescription>
                Evidence extracted from the source file. Rule checks use this
                text and visual data.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {content.extraction ? (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge
                      variant={
                        content.extraction.status === "COMPLETED"
                          ? "success"
                          : content.extraction.status === "FAILED"
                            ? "danger"
                            : "info"
                      }
                    >
                      {content.extraction.status}
                    </Badge>
                    {extractionData?.ocrConfidence !== undefined ? (
                      <Badge variant="outline">
                        OCR confidence {extractionData.ocrConfidence}
                      </Badge>
                    ) : null}
                    {extractionData?.ocrPages ? (
                      <Badge variant="outline">
                        OCR on {extractionData.ocrPages} page{extractionData.ocrPages === 1 ? "" : "s"}
                      </Badge>
                    ) : null}
                    {extractionData?.pages ? (
                      <Badge variant="outline">
                        {extractionData.pages} pages
                      </Badge>
                    ) : null}
                    {extractionData?.width && extractionData?.height ? (
                      <Badge variant="outline">
                        {extractionData.width}×{extractionData.height}
                      </Badge>
                    ) : null}
                    <Badge variant="outline">
                      {content.extraction.text?.length ?? 0} characters
                    </Badge>
                  </div>

                  {content.extraction.status === "FAILED" ? (
                    <p
                      role="alert"
                      className="rounded-md border border-danger/20 bg-danger-soft px-3 py-2 text-xs leading-5 text-danger"
                    >
                      {content.extraction.error ?? "Extraction failed."}
                    </p>
                  ) : null}

                  {extractionData?.notes?.length ? (
                    <ul className="space-y-1 text-[11px] leading-5 text-ink-muted">
                      {extractionData.notes.map((note) => (
                        <li key={note}>• {note}</li>
                      ))}
                    </ul>
                  ) : null}

                  {extractionData?.dominantColors?.length ? (
                    <div>
                      <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-ink-muted">
                        Dominant colors
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {extractionData.dominantColors.map((color) => (
                          <span
                            key={`${color.hex}-${color.percentage}`}
                            className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-2 py-0.5 text-[10px] text-ink-soft"
                          >
                            <span
                              aria-hidden="true"
                              className="size-3 rounded-full border border-line-strong"
                              style={{ backgroundColor: color.hex }}
                            />
                            {color.hex} · {color.percentage}%
                          </span>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {content.extraction.text ? (
                    <pre className="max-h-80 overflow-auto whitespace-pre-wrap rounded-md border border-line bg-surface-muted p-3 font-sans text-xs leading-5 text-ink-soft">
                      {content.extraction.text}
                    </pre>
                  ) : content.extraction.status === "COMPLETED" ? (
                    <p className="rounded-md border border-dashed border-line-strong px-3 py-4 text-center text-xs text-ink-muted">
                      No text was extracted from this file.
                    </p>
                  ) : null}
                </div>
              ) : (
                <p className="rounded-md border border-dashed border-line-strong px-3 py-5 text-center text-xs text-ink-muted">
                  Extraction has not run yet.
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Assessment</CardTitle>
              <CardDescription>
                {latestRun
                  ? `Latest run ${dateFormatter.format(latestRun.createdAt)} · ${latestRun.engineVersion ?? "unknown engine"}`
                  : "No analysis run has been recorded for this content."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {latestRun?.status === "COMPLETED" ? (
                <div className="space-y-5">
                  <div className="flex items-end justify-between gap-4 rounded-md border border-line bg-surface-muted px-4 py-4">
                    <div>
                      <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-ink-muted">
                        Overall
                      </p>
                      <p className="mt-1 font-display text-4xl leading-none text-ink">
                        {latestRun.overallScore ?? "—"}
                        {latestRun.overallScore !== null ? (
                          <span className="text-sm text-ink-muted"> / 100</span>
                        ) : null}
                      </p>
                    </div>
                    <Badge variant="outline">
                      {latestRun.findings.length} findings
                    </Badge>
                  </div>

                  <div>
                    <ScoreRow
                      label="Brand identity"
                      score={latestRun.brandIdentityScore}
                      unavailableReason="Brand identity requires extracted text or visual evidence."
                    />
                    <ScoreRow
                      label="Visual quality"
                      score={latestRun.visualQualityScore}
                      unavailableReason="Visual scoring is available for images only."
                    />
                    <ScoreRow
                      label="Brand vibe"
                      score={latestRun.brandVibeScore}
                      unavailableReason="Brand vibe requires configured AI reasoning."
                    />
                    <ScoreRow
                      label="Content"
                      score={latestRun.contentScore}
                      unavailableReason="Content scoring requires extracted text."
                    />
                    <ScoreRow
                      label="Compliance"
                      score={latestRun.complianceScore}
                      unavailableReason="Compliance scoring requires extracted text."
                    />
                  </div>

                  <div className="rounded-md border border-line bg-surface-muted p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge
                        variant={
                          ai?.status === "completed"
                            ? "success"
                            : ai?.status === "failed"
                              ? "danger"
                              : "neutral"
                        }
                      >
                        AI{" "}
                        {ai?.status === "completed"
                          ? "completed"
                          : ai?.status === "failed"
                            ? "failed"
                            : "not configured"}
                      </Badge>
                      {ai?.model ? (
                        <code className="text-[10px] text-ink-muted">
                          {ai.model}
                        </code>
                      ) : null}
                    </div>
                    {ai?.status === "not-configured" ? (
                      <p className="mt-2 text-[11px] leading-5 text-ink-muted">
                        Deterministic checks are complete. Brand vibe is not
                        scored because no AI provider is configured.
                      </p>
                    ) : null}
                    {ai?.status === "failed" ? (
                      <p className="mt-2 text-[11px] leading-5 text-danger">
                        AI review failed; deterministic results are unaffected.
                        {ai.error ? ` ${ai.error}` : ""}
                      </p>
                    ) : null}
                    {ai?.summary ? (
                      <p className="mt-3 text-xs leading-6 text-ink-soft">
                        {ai.summary}
                      </p>
                    ) : null}
                    {ai?.brandVibeRationale ? (
                      <p className="mt-2 text-[11px] leading-5 text-ink-muted">
                        Vibe rationale: {ai.brandVibeRationale}
                      </p>
                    ) : null}
                    {ai?.brandVibeEvidence?.quote ? (
                      <blockquote className="mt-2 border-l-2 border-accent/40 pl-3 text-[11px] leading-5 text-ink-muted">
                        Supporting tone rule: {ai.brandVibeEvidence.ruleName ?? "Active tone rule"} · “{ai.brandVibeEvidence.quote}”
                      </blockquote>
                    ) : null}
                  </div>
                </div>
              ) : latestRun?.status === "FAILED" ? (
                <p
                  role="alert"
                  className="rounded-md border border-danger/20 bg-danger-soft px-3 py-2 text-xs leading-5 text-danger"
                >
                  {latestRun.error ?? "The latest analysis failed."}
                </p>
              ) : latestRun ? (
                <p className="text-xs text-ink-muted">
                  Analysis is {latestRun.status.toLowerCase()}.
                </p>
              ) : (
                <p className="rounded-md border border-dashed border-line-strong px-3 py-5 text-center text-xs text-ink-muted">
                  Run extraction and analysis to generate scores.
                </p>
              )}
            </CardContent>
          </Card>

          {limitations.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>Limitations</CardTitle>
                <CardDescription>
                  What this run could and could not verify. Missing evidence is
                  never treated as a pass.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-[11px] leading-5 text-ink-soft">
                  {limitations.map((limitation) => (
                    <li key={limitation} className="flex gap-2">
                      <span aria-hidden="true" className="text-ink-muted">
                        —
                      </span>
                      <span>{limitation}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ) : null}

          {analysisMeta?.fontMatch ? (
            <Card>
              <CardHeader>
                <CardTitle>Typography match</CardTitle>
                <CardDescription>Font family metadata compared with the brand’s approved fonts.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-xs text-ink-soft">
                <Badge variant={analysisMeta.fontMatch.status === "matched" ? "success" : analysisMeta.fontMatch.status === "mismatch" ? "warning" : "outline"}>
                  {analysisMeta.fontMatch.status === "matched" ? "Approved font found" : analysisMeta.fontMatch.status === "mismatch" ? "Font mismatch" : analysisMeta.fontMatch.status === "not-configured" ? "No approved fonts configured" : "Font metadata unavailable"}
                </Badge>
                {analysisMeta.fontMatch.observed?.length ? <p>Found: {analysisMeta.fontMatch.observed.join(", ")}</p> : null}
                {analysisMeta.fontMatch.approved?.length ? <p>Approved: {analysisMeta.fontMatch.approved.join(", ")}</p> : null}
              </CardContent>
            </Card>
          ) : null}

          {content.supervisorEscalations.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>Supervisor escalation history</CardTitle>
                <CardDescription>
                  The Manager’s question and the Supervisor’s recorded assessment.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ol className="space-y-3">
                  {content.supervisorEscalations.map((escalation) => (
                    <li key={escalation.id} className="rounded-md border border-line bg-surface-muted px-3 py-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-xs font-medium text-ink">
                          Asked by {escalation.raisedBy.name} · assigned to {escalation.supervisor.name}
                        </p>
                        <Badge variant={escalation.status === "OPEN" ? "warning" : "success"}>
                          {escalation.status === "OPEN" ? "Waiting for Supervisor" : "Resolved"}
                        </Badge>
                      </div>
                      <p className="mt-1 text-[10px] text-ink-muted">
                        {dateFormatter.format(escalation.createdAt)}
                      </p>
                      <p className="mt-2 text-xs leading-5 text-ink-soft">{escalation.question}</p>
                      {escalation.resolution ? (
                        <blockquote className="mt-3 border-l-2 border-accent/40 pl-3 text-xs leading-5 text-ink-soft">
                          <span className="mb-1 block text-[10px] font-medium uppercase tracking-[0.14em] text-ink-muted">
                            Supervisor assessment{escalation.resolvedBy ? ` · ${escalation.resolvedBy.name}` : ""}
                          </span>
                          {escalation.resolution}
                        </blockquote>
                      ) : null}
                    </li>
                  ))}
                </ol>
              </CardContent>
            </Card>
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle>Review history</CardTitle>
              <CardDescription>
                Who submitted, decided, or commented, and when.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {content.reviews.length === 0 ? (
                <p className="rounded-md border border-dashed border-line-strong px-3 py-4 text-center text-xs text-ink-muted">
                  No review activity yet.
                </p>
              ) : (
                <ol className="space-y-3">
                  {content.reviews.map((review) => (
                    <li
                      key={review.id}
                      className="rounded-md border border-line bg-surface-muted px-3 py-2.5"
                    >
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span className="text-xs font-medium text-ink">
                          {reviewActionLabels[review.action] ?? review.action}
                        </span>
                        <span className="text-[10px] text-ink-muted">
                          {review.actor.name} ·{" "}
                          {roleLabels[review.actor.role] ?? review.actor.role}
                        </span>
                      </div>
                      <p className="mt-0.5 text-[10px] text-ink-muted">
                        {dateFormatter.format(review.createdAt)}
                      </p>
                      {review.comment ? (
                        <p className="mt-1.5 text-[11px] leading-5 text-ink-soft">
                          {review.comment}
                        </p>
                      ) : null}
                    </li>
                  ))}
                </ol>
              )}
            </CardContent>
          </Card>

          {content.analysisRuns.length > 1 ? (
            <Card>
              <CardHeader>
                <CardTitle>Analysis history</CardTitle>
                <CardDescription>
                  Previous runs are retained so review decisions keep their
                  evidence.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="divide-y divide-line">
                  {content.analysisRuns.map((run, index) => (
                    <li
                      key={run.id}
                      className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0"
                    >
                      <div>
                        <p className="text-xs text-ink">
                          {dateFormatter.format(run.createdAt)}
                          {index === 0 ? (
                            <Badge variant="accent" className="ml-2">
                              Latest
                            </Badge>
                          ) : null}
                        </p>
                        <p className="text-[10px] text-ink-muted">
                          {run.status} · {run.findings.length} findings
                        </p>
                      </div>
                      <span className="text-sm font-medium text-ink">
                        {run.overallScore ?? "—"}
                      </span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>

      <Card className="mt-6">
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle>Findings</CardTitle>
              <CardDescription>
                Evidence-backed issues from the latest completed analysis. Rule
                names link each finding back to the brand configuration.
              </CardDescription>
            </div>
            {latestRun?.status === "COMPLETED" ? (
              <Badge variant="outline">
                {latestRun.findings.length} in latest run
              </Badge>
            ) : null}
          </div>
        </CardHeader>
        <CardContent>
          {latestRun?.status === "COMPLETED" ? (
            latestRun.findings.length === 0 ? (
              <p className="rounded-md border border-dashed border-line-strong px-4 py-8 text-center text-xs text-ink-muted">
                No findings were produced by the configured checks. This is not
                a guarantee of compliance.
              </p>
            ) : (
              <ul className="space-y-3">
                {latestRun.findings.map((finding) => {
                  const sourceLabel = finding.rule?.name
                    ? `Rule · ${finding.rule.name}`
                    : finding.source === "AI"
                      ? "AI reasoning"
                      : "Visual check";
                  const evidence = finding.evidence as
                    | Record<string, unknown>
                    | null;
                  const methodLabel = finding.rule
                    ? `Deterministic check from rule “${finding.rule.name}”`
                    : finding.source === "AI"
                      ? "Model reasoning over extracted evidence (advisory)"
                      : "Heuristic visual or palette check";
                  const confidenceLabel =
                    finding.confidence === null
                      ? null
                      : `${Math.round(finding.confidence * 100)}%`;

                  return (
                    <li
                      key={finding.id}
                      className="rounded-md border border-line bg-surface-muted p-4"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge
                          variant={severityVariant(finding.severity)}
                          title={
                            severityDecisionDescriptions[
                              severityDecisionBuckets[finding.severity] ??
                                "Suggest"
                            ]
                          }
                        >
                          {severityDecisionLabel(finding.severity)}
                        </Badge>
                        <Badge variant="outline">
                          {ruleCategoryLabels[finding.category]}
                        </Badge>
                        <Badge variant="neutral">{sourceLabel}</Badge>
                        <Badge
                          variant={
                            findingStatusVariants[finding.status] ?? "neutral"
                          }
                        >
                          {findingStatusLabels[finding.status] ?? finding.status}
                        </Badge>
                      </div>
                      <p className="mt-2 text-sm font-medium text-ink">
                        {finding.title}
                      </p>
                      <p className="mt-1 max-w-4xl text-xs leading-5 text-ink-soft">
                        {finding.description}
                      </p>
                      {finding.recommendation ? (
                        <p className="mt-2 text-xs leading-5 text-ink-soft">
                          <span className="font-medium text-ink">
                            Recommendation:
                          </span>{" "}
                          {finding.recommendation}
                        </p>
                      ) : null}

                      <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[10px] leading-4 text-ink-muted">
                        <span>Method: {methodLabel}</span>
                        <span>
                          Confidence:{" "}
                          {confidenceLabel
                            ? `${confidenceLabel} in this match`
                            : "not recorded"}
                        </span>
                      </p>

                      {typeof evidence?.excerpt === "string" ? (
                        <blockquote className="mt-3 border-l-2 border-accent/40 bg-surface px-3 py-2 text-[11px] leading-5 text-ink-soft">
                          {evidence.excerpt}
                        </blockquote>
                      ) : null}

                      {evidence ? null : (
                        <p className="mt-2 text-[10px] italic leading-4 text-ink-muted">
                          No direct evidence was captured for this finding.
                        </p>
                      )}

                      {evidence ? (
                        <details className="mt-2">
                          <summary className="cursor-pointer text-[10px] font-medium uppercase tracking-[0.14em] text-ink-muted hover:text-ink">
                            Evidence
                          </summary>
                          <pre className="mt-2 max-h-48 overflow-auto rounded bg-surface p-2 text-[10px] leading-5 text-ink-muted">
                            {JSON.stringify(evidence, null, 2).slice(0, 2000)}
                          </pre>
                        </details>
                      ) : null}

                      {canUpdateFindings ? (
                        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3">
                          <span className="text-[10px] font-medium uppercase tracking-[0.14em] text-ink-muted">
                            Reviewer triage
                          </span>
                          <FindingStatusForm
                            findingId={finding.id}
                            status={finding.status}
                          />
                        </div>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            )
          ) : (
            <p className="rounded-md border border-dashed border-line-strong px-4 py-8 text-center text-xs text-ink-muted">
              Findings appear after a successful analysis run.
            </p>
          )}
        </CardContent>
      </Card>

      <p className="mt-4 text-[11px] text-ink-muted">
        Brand:{" "}
        <Link
          href={`/brands/${content.brand.id}`}
          className="font-medium text-accent hover:text-accent-strong"
        >
          {content.brand.name}
        </Link>
        {canUpdateFindings
          ? " · Findings can be triaged while the review is open."
          : null}
      </p>
    </>
  );
}

