import { ArrowRight, ClipboardCheck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { buttonStyles } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { requireUser } from "@/lib/auth/guards";
import { hasPermission, roleLabels } from "@/lib/auth/permissions";
import { CONTENT_STATUS_LABELS, CONTENT_STATUS_VARIANTS } from "@/lib/content/constants";
import { db } from "@/lib/db";
import { reviewActionLabels } from "@/lib/reviews/types";

export const metadata: Metadata = {
  title: "Reviews",
};

const dateFormatter = new Intl.DateTimeFormat("en", {
  dateStyle: "medium",
  timeStyle: "short",
});

const actionVariants: Record<
  string,
  "neutral" | "accent" | "success" | "warning" | "danger" | "info" | "outline"
> = {
  SUBMITTED: "accent",
  APPROVED: "success",
  CHANGES_REQUESTED: "warning",
  COMMENTED: "neutral",
};

const reviewStatuses = [
  "REVIEW_READY",
  "SUBMITTED",
  "CHANGES_REQUESTED",
  "APPROVED",
] as const;

const findingStatusFilters = [
  "OPEN",
  "ACKNOWLEDGED",
  "RESOLVED",
  "DISMISSED",
] as const;

const decisionBuckets: Record<string, string[]> = {
  BLOCK: ["CRITICAL", "HIGH"],
  WARN: ["MEDIUM"],
  SUGGEST: ["LOW", "INFO"],
};

type ReviewSearchParams = {
  status?: string;
  severity?: string;
  repeated?: string;
};

function resolveContentStatus(value: string | undefined) {
  return value && (reviewStatuses as readonly string[]).includes(value)
    ? (value as (typeof reviewStatuses)[number])
    : null;
}

function resolveFindingStatus(value: string | undefined) {
  return value && (findingStatusFilters as readonly string[]).includes(value)
    ? (value as (typeof findingStatusFilters)[number])
    : null;
}

function resolveSeverities(value: string | undefined): string[] | null {
  if (!value) {
    return null;
  }

  return decisionBuckets[value] ?? null;
}

export default async function ReviewsPage({
  searchParams,
}: {
  searchParams: Promise<ReviewSearchParams>;
}) {
  const user = await requireUser();
  const params = await searchParams;
  const contentStatus = resolveContentStatus(params.status);
  const findingStatus = resolveFindingStatus(params.status);
  const severities = resolveSeverities(params.severity);
  const repeatedOnly = params.repeated === "true";
  const canViewAll = hasPermission(user.role, "content:view-all");
  const canReview = hasPermission(user.role, "content:review");

  const allContents = await db.content.findMany({
    where: {
      ...(user.role === "SUPERVISOR"
        ? {
            OR: [
              { status: "APPROVED", supervisorAssignment: { is: { supervisorId: user.id } } },
              { status: "SUBMITTED", supervisorEscalations: { some: { supervisorId: user.id, status: "OPEN" } } },
            ],
          }
        : { ...(canViewAll ? {} : { uploadedById: user.id }), status: { in: [...reviewStatuses] } }),
    },
    orderBy: { updatedAt: "desc" },
    include: {
      brand: { select: { name: true } },
      uploadedBy: { select: { name: true } },
      analysisRuns: {
        orderBy: { createdAt: "desc" },
        take: 1,
        include: {
          _count: { select: { findings: true } },
          findings: {
            select: { ruleId: true, status: true, severity: true },
          },
        },
      },
      reviews: {
        orderBy: { createdAt: "desc" },
        take: 1,
        include: { actor: { select: { name: true } } },
      },
      supervisorEscalations: {
        where: { supervisorId: user.id, status: "OPEN" },
        include: { supervisor: { select: { name: true } } },
      },
    },
  });

  const contents = allContents.filter((content) => {
    if (contentStatus && content.status !== contentStatus) {
      return false;
    }

    const findings = content.analysisRuns[0]?.findings ?? [];

    if (
      findingStatus &&
      !findings.some((finding) => finding.status === findingStatus)
    ) {
      return false;
    }

    if (
      severities &&
      !findings.some(
        (finding) =>
          finding.status === "OPEN" && severities.includes(finding.severity),
      )
    ) {
      return false;
    }

    if (repeatedOnly) {
      const openByRule = new Map<string, number>();

      for (const finding of findings) {
        if (finding.status !== "OPEN" || !finding.ruleId) {
          continue;
        }

        openByRule.set(
          finding.ruleId,
          (openByRule.get(finding.ruleId) ?? 0) + 1,
        );
      }

      if (!Array.from(openByRule.values()).some((count) => count > 1)) {
        return false;
      }
    }

    return true;
  });

  const filterLabel = contentStatus
    ? CONTENT_STATUS_LABELS[contentStatus]
    : findingStatus
      ? `findings ${findingStatus.toLowerCase()}`
      : severities
        ? `open findings in the ${params.severity?.toLowerCase()} decision bucket`
        : repeatedOnly
          ? "repeated open rules in the latest run"
          : null;

  const activity = await db.review.findMany({
    where: user.role === "SUPERVISOR"
      ? {
          content: {
            OR: [
              { status: "APPROVED", supervisorAssignment: { is: { supervisorId: user.id } } },
              { status: "SUBMITTED", supervisorEscalations: { some: { supervisorId: user.id, status: "OPEN" } } },
            ],
          },
        }
      : canViewAll ? undefined : { content: { uploadedById: user.id } },
    orderBy: { createdAt: "desc" },
    take: 8,
    include: {
      actor: { select: { name: true, role: true } },
      content: {
        select: {
          id: true,
          title: true,
          originalFilename: true,
          brand: { select: { name: true } },
        },
      },
    },
  });

  const awaitingDecision = allContents.filter(
    (content) => content.status === "SUBMITTED",
  );
  const openEscalationCount = allContents.filter(
    (content) => content.supervisorEscalations.length > 0,
  ).length;
  const needsSubmission = allContents.filter(
    (content) =>
      content.status === "REVIEW_READY" ||
      content.status === "CHANGES_REQUESTED",
  );
  const approvedCount = allContents.filter(
    (content) => content.status === "APPROVED",
  ).length;

  return (
    <>
      <PageHeader
        eyebrow="Human review"
        title="Reviews"
        description={
          user.role === "MANAGER" || user.role === "ADMIN"
            ? "Submitted content waiting for a decision, plus the review history that supports every approval and change request."
            : user.role === "SUPERVISOR"
              ? "Review Manager escalations assigned to you, plus approved items awaiting secondary review."
            : "Content you have submitted or prepared for review, with the decisions and comments recorded against it."
        }
        actions={
          <Badge variant={(user.role === "SUPERVISOR" ? openEscalationCount : awaitingDecision.length) > 0 ? "accent" : "outline"}>
            {user.role === "SUPERVISOR"
              ? `${openEscalationCount} open escalations`
              : awaitingDecision.length > 0
                ? `${awaitingDecision.length} awaiting decision`
                : needsSubmission.length > 0
                  ? `${needsSubmission.length} awaiting submission`
                  : "Queue clear"}
          </Badge>
        }
      />

      {filterLabel ? (
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <Badge variant="outline">Filtered: {filterLabel}</Badge>
          <Link
            href="/reviews"
            className="text-xs font-medium text-accent hover:text-accent-strong"
          >
            Clear filter
          </Link>
        </div>
      ) : null}

      {contents.length === 0 ? (
        <EmptyState
          icon={ClipboardCheck}
          title={
            filterLabel
              ? "No review items match this filter"
              : "Nothing in the review workflow"
          }
          description={
            filterLabel
              ? "Clear the filter to see the full review queue."
              : user.role === "SUPERVISOR"
                ? "A Manager can escalate a submitted review to you or assign an approved item for secondary review."
              : canReview
                ? "When a creator submits review-ready content, it will appear here for approval or a change request."
                : "Upload content, let extraction and analysis finish, then submit it for a manager decision."
          }
          action={
            filterLabel ? (
              <Link
                href="/reviews"
                className={buttonStyles({ variant: "secondary" })}
              >
                Clear filter
              </Link>
            ) : hasPermission(user.role, "content:create") ? (
              <Link
                href="/content/new"
                className={buttonStyles({ variant: "primary" })}
              >
                Upload content
              </Link>
            ) : undefined
          }
        />
      ) : (
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <CardTitle>Review queue</CardTitle>
                <CardDescription>
                  {user.role === "SUPERVISOR"
                    ? "Manager escalations and approved items assigned for secondary review appear in this queue."
                    : canReview
                    ? "Submitted items are locked from further processing until you approve them or request changes."
                    : `${needsSubmission.length} of your items are not yet submitted. Open an item to submit it when ready.`}
                </CardDescription>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline">
                  {needsSubmission.length} awaiting submission
                </Badge>
                <Badge variant="success">{approvedCount} approved</Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <ul className="divide-y divide-line">
              {contents.map((content) => {
                const latestRun = content.analysisRuns[0] ?? null;
                const latestReview = content.reviews[0] ?? null;
                const escalation = content.supervisorEscalations[0] ?? null;
                const title = content.title ?? content.originalFilename;

                return (
                  <li
                    key={content.id}
                    className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          href={`/content/${content.id}`}
                          className="truncate text-sm font-medium text-ink hover:text-accent-strong"
                        >
                          {title}
                        </Link>
                        <Badge
                          variant={
                            CONTENT_STATUS_VARIANTS[content.status] ?? "neutral"
                          }
                        >
                          {CONTENT_STATUS_LABELS[content.status] ??
                            content.status}
                        </Badge>
                        {escalation ? <Badge variant="warning">Supervisor input pending</Badge> : null}
                      </div>
                      <p className="mt-1 truncate text-xs text-ink-muted">
                        {content.brand.name} · {content.uploadedBy.name} ·{" "}
                        {dateFormatter.format(content.updatedAt)}
                      </p>
                      {latestReview?.comment ? (
                        <p className="mt-1 line-clamp-2 max-w-3xl text-[11px] leading-5 text-ink-muted">
                          {reviewActionLabels[latestReview.action] ??
                            latestReview.action}{" "}
                          by {latestReview.actor.name}: {latestReview.comment}
                        </p>
                      ) : null}
                      {escalation ? (
                        <p className="mt-1 line-clamp-2 max-w-3xl text-[11px] leading-5 text-ink-muted">
                          Manager’s question: {escalation.question}
                        </p>
                      ) : null}
                    </div>

                    <div className="flex shrink-0 flex-wrap items-center gap-2">
                      {latestRun?.overallScore !== null &&
                      latestRun?.overallScore !== undefined ? (
                        <Badge variant="outline">
                          Score {latestRun.overallScore}
                        </Badge>
                      ) : null}
                      {latestRun ? (
                        <Badge variant="outline">
                          {latestRun._count.findings} findings
                        </Badge>
                      ) : null}
                      <Link
                        href={`/content/${content.id}`}
                        className="inline-flex items-center gap-1 text-xs font-medium text-accent hover:text-accent-strong"
                      >
                        {content.status === "SUBMITTED" && canReview
                          ? "Review"
                          : "Open"}
                        <ArrowRight
                          aria-hidden="true"
                          className="size-3.5"
                          strokeWidth={1.75}
                        />
                      </Link>
                    </div>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      )}

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Recent review activity</CardTitle>
          <CardDescription>
            {canViewAll
              ? "The most recent submissions, decisions, and comments across the workspace."
              : "The most recent review activity on your content."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {activity.length === 0 ? (
            <p className="rounded-md border border-dashed border-line-strong px-4 py-8 text-center text-xs text-ink-muted">
              No review activity has been recorded yet.
            </p>
          ) : (
            <ul className="divide-y divide-line">
              {activity.map((review) => (
                <li
                  key={review.id}
                  className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-start sm:justify-between"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge
                        variant={actionVariants[review.action] ?? "neutral"}
                      >
                        {reviewActionLabels[review.action] ?? review.action}
                      </Badge>
                      <Link
                        href={`/content/${review.content.id}`}
                        className="truncate text-xs font-medium text-ink hover:text-accent-strong"
                      >
                        {review.content.title ??
                          review.content.originalFilename}
                      </Link>
                      <span className="text-[10px] text-ink-muted">
                        {review.content.brand.name}
                      </span>
                    </div>
                    {review.comment ? (
                      <p className="mt-1 line-clamp-2 max-w-3xl text-[11px] leading-5 text-ink-soft">
                        {review.comment}
                      </p>
                    ) : null}
                  </div>
                  <div className="shrink-0 text-[10px] text-ink-muted sm:text-right">
                    <p>
                      {review.actor.name} ·{" "}
                      {roleLabels[review.actor.role] ?? review.actor.role}
                    </p>
                    <p>{dateFormatter.format(review.createdAt)}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </>
  );
}
