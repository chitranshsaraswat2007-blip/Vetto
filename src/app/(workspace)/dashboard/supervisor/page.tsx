import { Gavel, ArrowRight, CheckCircle } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
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

export const metadata: Metadata = {
  title: "Supervisor Home",
};

async function getResolvedThisWeekCount(supervisorId: string) {
  const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  return db.finding.count({
    where: { status: "RESOLVED", updatedAt: { gte: oneWeekAgo }, analysisRun: { content: { supervisorAssignment: { is: { supervisorId } }, status: "APPROVED" } } },
  });
}

export default async function SupervisorHomePage() {
  const user = await requirePermission("finding:update");
  const assignmentScope = { analysisRun: { content: { status: "APPROVED" as const, supervisorAssignment: { is: { supervisorId: user.id } } } } };

  const [
    highSeverityItems,
    highSeverityCount,
    dismissedCount,
    resolvedThisWeek,
    recentlyFlagged,
    assignedFindingStatuses,
    secondaryReviewsThisWeek,
  ] = await Promise.all([
    db.finding.findMany({
      where: {
        ...assignmentScope,
        status: "OPEN",
        severity: { in: ["CRITICAL", "HIGH"] },
      },
      orderBy: { updatedAt: "asc" },
      take: 10,
      include: {
        rule: { select: { name: true, severity: true } },
        analysisRun: {
          include: {
            content: {
              include: {
                brand: { select: { name: true } },
                uploadedBy: { select: { name: true } },
              },
            },
          },
        },
      },
    }),
    db.finding.count({
      where: {
        ...assignmentScope,
        status: "OPEN",
        severity: { in: ["CRITICAL", "HIGH"] },
      },
    }),
    db.finding.count({
      where: { ...assignmentScope, status: "DISMISSED" },
    }),
    getResolvedThisWeekCount(user.id),
    db.finding.findMany({
      where: {
        ...assignmentScope,
        status: "OPEN",
        severity: { in: ["CRITICAL", "HIGH"] },
      },
      orderBy: { createdAt: "desc" },
      take: 5,
      include: {
        rule: { select: { name: true } },
        analysisRun: {
          include: {
            content: {
              include: {
                brand: { select: { name: true } },
              },
            },
          },
        },
      },
    }),
    db.finding.groupBy({
      by: ["status"],
      where: assignmentScope,
      _count: { _all: true },
    }),
    db.review.findMany({
      where: { actorId: user.id, action: "SUPERVISOR_REVIEWED", createdAt: { gte: weekStartUtc() } },
      select: { createdAt: true },
    }),
  ]);

  const stats = [
    {
      label: "Block-Severity Findings",
      value: highSeverityCount,
      hint: "Critical/high findings still open",
      href: "/reviews?severity=BLOCK",
    },
    {
      label: "Dismissed Findings",
      value: dismissedCount,
      hint: "Dismissed by reviewers",
      href: "/reviews?status=DISMISSED",
    },
    {
      label: "Resolved This Week",
      value: resolvedThisWeek,
      hint: "Findings resolved in the last 7 days",
      href: "/reviews?status=RESOLVED",
    },
  ];

  return (
    <>
      <PageHeader
        eyebrow="Supervisor"
        title="Findings Triage"
        description="Review only manager-approved items assigned to you, add your independent assessment, and triage their findings."
      />

      <div className="grid gap-4 sm:grid-cols-3">
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
          title="Assigned finding status"
          description="Triage state across findings on reviews assigned to you."
          data={assignedFindingStatuses.filter((row) => row._count._all > 0).map((row) => ({ label: row.status[0] + row.status.slice(1).toLowerCase(), value: row._count._all }))}
        />
        <WeekBarChart
          title="Secondary reviews"
          description="Your independent reviews submitted for Manager-approved work."
          data={weekSeries(secondaryReviewsThisWeek.map((item) => item.createdAt))}
        />
      </div>

      <Card className="mt-6 min-w-0">
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle>Block-Severity Findings</CardTitle>
              <CardDescription>
                Open critical and high findings. Triaging one to dismissed
                requires a recorded reason.
              </CardDescription>
            </div>
            <Badge variant={highSeverityCount > 0 ? "danger" : "outline"}>
              {highSeverityCount} open
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {highSeverityItems.length === 0 ? (
            <div className="rounded-md border border-dashed border-line-strong px-4 py-8 text-center">
              <Gavel className="mx-auto size-6 text-ink-muted" strokeWidth={1.5} />
              <p className="mt-2 text-xs text-ink-muted">
                No high-severity findings are open.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-line">
              {highSeverityItems.map((finding) => (
                <li
                  key={finding.id}
                  className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 py-3 first:pt-0 last:pb-0"
                >
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-ink">
                      {finding.rule?.name ?? "Unnamed rule"}
                    </p>
                    <p className="mt-0.5 truncate text-[10px] text-ink-muted">
                      {finding.analysisRun?.content?.brand?.name ?? "Unknown brand"} ·{" "}
                      {finding.description?.slice(0, 100) ?? "No description"}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Badge variant="danger">
                      {finding.severity ?? "HIGH"}
                    </Badge>
                    <Link
                      href={`/content/${finding.analysisRun?.content?.id}?finding=${finding.id}`}
                      className="inline-flex items-center gap-1 text-[11px] font-medium text-accent hover:text-accent-strong"
                    >
                      Decide
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

      <div className="mt-6 grid gap-6 sm:grid-cols-2">
        <Card className="min-w-0">
          <CardHeader>
            <CardTitle>Dismissed Findings</CardTitle>
            <CardDescription>
              Findings dismissed by reviewers, kept visible for audit.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg border border-line bg-surface p-4">
              <CheckCircle className="size-5 text-warning" strokeWidth={1.5} />
              <p className="mt-2 font-medium text-ink">Dismissed Findings</p>
              <p className="mt-1 text-xs text-ink-muted">
                {dismissedCount} dismissed findings on record
              </p>
              <Link
                href="/reviews?status=DISMISSED"
                className="mt-3 inline-flex text-xs font-medium text-accent hover:text-accent-strong"
              >
                Review dismissed
              </Link>
            </div>
          </CardContent>
        </Card>

        <Card className="min-w-0">
          <CardHeader>
            <CardTitle>Recently Flagged</CardTitle>
            <CardDescription>
              The newest open high-severity findings.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {recentlyFlagged.length === 0 ? (
              <p className="rounded-md border border-dashed border-line-strong px-4 py-8 text-center text-xs text-ink-muted">
                No high-severity findings have been recorded yet.
              </p>
            ) : (
              <ul className="divide-y divide-line">
                {recentlyFlagged.map((finding) => (
                  <li
                    key={finding.id}
                    className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 py-3 first:pt-0 last:pb-0"
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-ink">
                        {finding.rule?.name ?? "Unnamed rule"}
                      </p>
                      <p className="mt-0.5 truncate text-[10px] text-ink-muted">
                        {finding.analysisRun?.content?.brand?.name ?? "Unknown brand"} ·{" "}
                        {finding.status}
                      </p>
                    </div>
                    <Badge
                      variant={
                        finding.status === "RESOLVED"
                          ? "success"
                          : finding.status === "DISMISSED"
                            ? "warning"
                            : "danger"
                      }
                    >
                      {finding.status}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
