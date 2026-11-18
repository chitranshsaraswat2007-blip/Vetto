import { ClipboardCheck, AlertTriangle, CheckCircle, ArrowRight } from "lucide-react";
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
import { PageHeader } from "@/components/ui/page-header";
import { StatusDonut, WeekBarChart, weekSeries, weekStartUtc } from "@/components/dashboard/charts";
import { requirePermission } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { reviewActionLabels } from "@/lib/reviews/types";

export const metadata: Metadata = {
  title: "Manager Home",
};

const dateFormatter = new Intl.DateTimeFormat("en", {
  dateStyle: "medium",
});

export default async function ManagerHomePage() {
  const user = await requirePermission("content:review");

  const [
    pendingReviews,
    pendingReviewCount,
    openBlocks,
    openFindingsCount,
    findingsByRule,
    recentDecisions,
    workflowStatusRows,
    managerDecisionsThisWeek,
  ] = await Promise.all([
    db.content.findMany({
      where: { status: "SUBMITTED" },
      orderBy: { updatedAt: "asc" },
      take: 5,
      include: {
        brand: { select: { name: true } },
        uploadedBy: { select: { name: true } },
        analysisRuns: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { overallScore: true },
        },
      },
    }),
    db.content.count({ where: { status: "SUBMITTED" } }),
    db.finding.count({
      where: {
        status: "OPEN",
        severity: { in: ["CRITICAL", "HIGH"] },
      },
    }),
    db.finding.count({
      where: { status: "OPEN" },
    }),
    db.finding.groupBy({
      by: ["ruleId"],
      where: { status: "OPEN", ruleId: { not: null } },
      _count: { ruleId: true },
    }),
    db.review.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
      include: {
        actor: { select: { name: true } },
        content: {
          select: {
            id: true,
            title: true,
            originalFilename: true,
            brand: { select: { name: true } },
          },
        },
      },
    }),
    db.content.groupBy({
      by: ["status"],
      where: { status: { in: ["SUBMITTED", "APPROVED", "CHANGES_REQUESTED"] } },
      _count: { _all: true },
    }),
    db.review.findMany({
      where: {
        createdAt: { gte: weekStartUtc() },
        action: { in: ["APPROVED", "CHANGES_REQUESTED"] },
        ...(user.role === "MANAGER" ? { actorId: user.id } : {}),
      },
      select: { createdAt: true },
    }),
  ]);

  // Only rules with more than one open finding are "repeated"; a single open
  // finding is counted by the Open Findings card instead.
  const repeatedRuleCount = findingsByRule.filter(
    (row) => row._count.ruleId > 1,
  ).length;

  const stats = [
    {
      label: "Pending Reviews",
      value: pendingReviewCount,
      hint: "Submitted content awaiting decision",
      href: "/reviews",
    },
    {
      label: "Open Blocks",
      value: openBlocks,
      hint: "Critical/High severity findings",
      href: "/reviews?severity=BLOCK",
    },
    {
      label: "Open Findings",
      value: openFindingsCount,
      hint: "Findings awaiting resolution",
      href: "/reviews",
    },
    {
      label: "Repeated Rules",
      value: repeatedRuleCount,
      hint: "Rules with more than one open finding",
      href: "/reviews?repeated=true",
    },
  ];

  return (
    <>
      <PageHeader
        eyebrow="Manager"
        title="Review Queue"
        description="Review submitted content, decide on findings, and manage waivers."
        actions={
          <Link
            href="/reviews"
            className={buttonStyles({ variant: "primary", size: "sm" })}
          >
            <ClipboardCheck
              aria-hidden="true"
              className="size-3.5"
              strokeWidth={1.75}
            />
            Open Full Queue
          </Link>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => (
          <Link key={stat.label} href={stat.href} className="group">
            <Card className="dashboard-stat-card h-full min-w-0 p-5 transition-all group-hover:-translate-y-1 group-hover:shadow-raised">
              <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-ink-muted">
                {stat.label}
              </p>
              <p className="mt-2 font-display text-3xl leading-none text-ink">
                {stat.value}
              </p>
              <p className="mt-2 text-[11px] leading-5 text-ink-muted">
                {stat.hint}
              </p>
            </Card>
          </Link>
        ))}
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-2">
        <StatusDonut
          title="Review pipeline"
          description="Submitted, approved, and change-requested work across the workspace."
          data={workflowStatusRows.filter((row) => row._count._all > 0).map((row) => ({ label: row.status === "CHANGES_REQUESTED" ? "Changes requested" : row.status === "SUBMITTED" ? "Awaiting decision" : "Approved", value: row._count._all }))}
        />
        <WeekBarChart
          title="Decisions recorded"
          description={user.role === "MANAGER" ? "Approvals and change requests you recorded this week." : "Approvals and change requests recorded this week."}
          data={weekSeries(managerDecisionsThisWeek.map((item) => item.createdAt))}
        />
      </div>

      <div className="mt-6 grid items-start gap-6 xl:grid-cols-2">
        <Card className="min-w-0">
          <CardHeader>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <CardTitle>Awaiting Decision</CardTitle>
                <CardDescription>
                  Submitted content waiting for your review.
                </CardDescription>
              </div>
              <Badge variant={pendingReviewCount > 0 ? "accent" : "outline"}>
                {pendingReviewCount} pending
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            {pendingReviews.length === 0 ? (
              <div className="rounded-md border border-dashed border-line-strong px-4 py-8 text-center">
                <ClipboardCheck
                  aria-hidden="true"
                  className="mx-auto size-6 text-ink-muted"
                  strokeWidth={1.5}
                />
                <p className="mt-2 text-xs text-ink-muted">
                  No content is waiting for a review decision.
                </p>
                <Link
                  href="/reviews"
                  className="mt-3 inline-flex text-xs font-medium text-accent hover:text-accent-strong"
                >
                  Open reviews
                </Link>
              </div>
            ) : (
              <ul className="divide-y divide-line">
                {pendingReviews.map((content) => (
                  <li
                    key={content.id}
                    className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
                  >
                    <div className="min-w-0">
                      <Link
                        href={`/content/${content.id}`}
                        className="block truncate text-xs font-medium text-ink hover:text-accent-strong"
                      >
                        {content.title ?? content.originalFilename}
                      </Link>
                      <p className="mt-0.5 truncate text-[10px] text-ink-muted">
                        {content.brand.name} · {content.uploadedBy.name} ·{" "}
                        {dateFormatter.format(content.updatedAt)}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {content.analysisRuns[0]?.overallScore !== null &&
                      content.analysisRuns[0]?.overallScore !== undefined ? (
                        <Badge variant="outline">
                          {content.analysisRuns[0].overallScore}
                        </Badge>
                      ) : null}
                      <Link
                        href={`/content/${content.id}`}
                        className="inline-flex items-center gap-1 text-[11px] font-medium text-accent hover:text-accent-strong"
                      >
                        Review
                        <ArrowRight
                          aria-hidden="true"
                          className="size-3"
                          strokeWidth={1.75}
                        />
                      </Link>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="min-w-0">
          <CardHeader>
            <CardTitle>Governance Overview</CardTitle>
            <CardDescription>
              Open blocks, waivers, and repeated rules across the workspace.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-lg border border-line bg-surface p-4">
                <AlertTriangle className="size-5 text-danger" strokeWidth={1.5} />
                <p className="mt-2 font-medium text-ink">Open Blocks</p>
                <p className="mt-1 text-xs text-ink-muted">
                  {openBlocks} critical/high findings
                </p>
              </div>
<div className="rounded-lg border border-line bg-surface p-4">
              <CheckCircle className="size-5 text-warning" strokeWidth={1.5} />
              <p className="mt-2 font-medium text-ink">Open Findings</p>
              <p className="mt-1 text-xs text-ink-muted">
                {openFindingsCount} awaiting resolution
              </p>
            </div>
              <div className="rounded-lg border border-line bg-surface p-4">
                <ClipboardCheck className="size-5 text-info" strokeWidth={1.5} />
                <p className="mt-2 font-medium text-ink">Repeated Rules</p>
                <p className="mt-1 text-xs text-ink-muted">
                  {repeatedRuleCount} rules flagged repeatedly
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="mt-6 grid items-start gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <Card className="min-w-0">
          <CardHeader>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <CardTitle>Recent Decisions</CardTitle>
                <CardDescription>
                  Submissions, approvals, and changes requested.
                </CardDescription>
              </div>
              <Link
                href="/reviews"
                className="text-xs font-medium text-accent hover:text-accent-strong"
              >
                All reviews
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {recentDecisions.length === 0 ? (
              <p className="rounded-md border border-dashed border-line-strong px-4 py-8 text-center text-xs text-ink-muted">
                No review activity has been recorded yet.
              </p>
            ) : (
              <ul className="divide-y divide-line">
                {recentDecisions.map((review) => (
                  <li
                    key={review.id}
                    className="flex flex-col gap-1 py-3 first:pt-0 last:pb-0"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline">
                        {reviewActionLabels[review.action] ?? review.action}
                      </Badge>
                      <Link
                        href={`/content/${review.content.id}`}
                        className="truncate text-xs font-medium text-ink hover:text-accent-strong"
                      >
                        {review.content.title ?? review.content.originalFilename}
                      </Link>
                      <span className="text-[10px] text-ink-muted">
                        {review.content.brand.name}
                      </span>
                    </div>
                    {review.comment ? (
                      <p className="line-clamp-2 text-[11px] leading-5 text-ink-soft">
                        {review.comment}
                      </p>
                    ) : (
                      null
                    )}
                    <p className="text-[10px] text-ink-muted">
                      {review.actor.name} ·{" "}
                      {dateFormatter.format(review.createdAt)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="min-w-0">
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>
              Common review tasks.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2">
              <Link
                href="/reviews?status=SUBMITTED"
                className="rounded-lg border border-line bg-surface p-4 transition-colors hover:border-line-strong hover:bg-surface-muted"
              >
                <ClipboardCheck className="size-5 text-ink-muted" strokeWidth={1.5} />
                <p className="mt-2 font-medium text-ink">Review Queue</p>
                <p className="mt-1 text-xs text-ink-muted">
                  {pendingReviewCount} items pending
                </p>
              </Link>
              <Link
                href="/reviews?severity=BLOCK"
                className="rounded-lg border border-line bg-surface p-4 transition-colors hover:border-line-strong hover:bg-surface-muted"
              >
                <AlertTriangle className="size-5 text-danger" strokeWidth={1.5} />
                <p className="mt-2 font-medium text-ink">Open Blocks</p>
                <p className="mt-1 text-xs text-ink-muted">
                  {openBlocks} findings to resolve
                </p>
              </Link>
              <Link
                href="/reviews"
                className="rounded-lg border border-line bg-surface p-4 transition-colors hover:border-line-strong hover:bg-surface-muted"
              >
                <CheckCircle className="size-5 text-warning" strokeWidth={1.5} />
                <p className="mt-2 font-medium text-ink">Open Findings</p>
                <p className="mt-1 text-xs text-ink-muted">
                  {openFindingsCount} awaiting resolution
                </p>
              </Link>
              <Link
                href="/content"
                className="rounded-lg border border-line bg-surface p-4 transition-colors hover:border-line-strong hover:bg-surface-muted"
              >
                <ArrowRight className="size-5 text-ink-muted" strokeWidth={1.5} />
                <p className="mt-2 font-medium text-ink">Content Library</p>
                <p className="mt-1 text-xs text-ink-muted">
                  Browse every uploaded asset
                </p>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
