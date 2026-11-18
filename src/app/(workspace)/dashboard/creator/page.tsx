import { Upload, ClipboardCheck, ArrowRight } from "lucide-react";
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
import { requireUser } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { CONTENT_STATUS_LABELS, CONTENT_STATUS_VARIANTS } from "@/lib/content/constants";

export const metadata: Metadata = {
  title: "Creator Home",
};

const dateFormatter = new Intl.DateTimeFormat("en", {
  dateStyle: "medium",
});

export default async function CreatorHomePage() {
  const user = await requireUser();
  const contentFilter = { uploadedById: user.id };

  const [
    totalContent,
    statusRows,
    openFindings,
    recentContents,
    mySubmissions,
    uploadsThisWeek,
  ] = await Promise.all([
    db.content.count({ where: contentFilter }),
    db.content.groupBy({
      by: ["status"],
      where: contentFilter,
      _count: { _all: true },
    }),
    db.finding.count({
      where: {
        status: "OPEN",
        analysisRun: { content: contentFilter },
      },
    }),
    db.content.findMany({
      where: contentFilter,
      orderBy: { createdAt: "desc" },
      take: 5,
      include: {
        brand: { select: { name: true } },
        analysisRuns: {
          orderBy: { createdAt: "desc" },
          take: 1,
          include: { _count: { select: { findings: true } } },
        },
      },
    }),
    db.content.findMany({
      where: { ...contentFilter, status: "SUBMITTED" },
      orderBy: { updatedAt: "asc" },
      take: 4,
      include: {
        brand: { select: { name: true } },
        analysisRuns: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { overallScore: true },
        },
      },
    }),
    db.content.findMany({
      where: { ...contentFilter, createdAt: { gte: weekStartUtc() } },
      select: { createdAt: true },
    }),
  ]);

  const countFor = (status: string) =>
    statusRows.find((row) => row.status === status)?._count._all ?? 0;
  const submitted = countFor("SUBMITTED");
  const reviewReady = countFor("REVIEW_READY");
  const changesRequested = countFor("CHANGES_REQUESTED");
  const approved = countFor("APPROVED");

  const stats = [
    {
      label: "My Content",
      value: totalContent,
      hint: `${reviewReady} ready · ${changesRequested} with changes requested`,
      href: "/content",
    },
    {
      label: "Awaiting Decision",
      value: submitted,
      hint: submitted > 0 ? "Locked while the review is open" : "No open review decisions",
      href: "/content?status=SUBMITTED",
    },
    {
      label: "Approved",
      value: approved,
      hint: "Approved by a reviewer",
      href: "/content?status=APPROVED",
    },
    {
      label: "Open Findings",
      value: openFindings,
      hint:
        openFindings > 0
          ? `${openFindings} finding${openFindings === 1 ? "" : "s"} to address`
          : "No open findings",
      href: "/content",
    },
  ];

  return (
    <>
      <PageHeader
        eyebrow="Creator"
        title="My Work"
        description="Upload, fix findings, and submit content for review."
        actions={
          <Link
            href="/content/new"
            className={buttonStyles({ variant: "primary", size: "sm" })}
          >
            <Upload
              aria-hidden="true"
              className="size-3.5"
              strokeWidth={1.75}
            />
            Upload Content
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
          title="My content mix"
          description="Where your work currently sits in the review lifecycle."
          data={statusRows.filter((row) => row._count._all > 0).map((row) => ({ label: CONTENT_STATUS_LABELS[row.status] ?? row.status, value: row._count._all }))}
        />
        <WeekBarChart
          title="Upload rhythm"
          description="New content you added each day this week."
          data={weekSeries(uploadsThisWeek.map((item) => item.createdAt))}
        />
      </div>

      <div className="mt-6 grid items-start gap-6 xl:grid-cols-2">
        <Card className="min-w-0">
          <CardHeader>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <CardTitle>My Submissions</CardTitle>
                <CardDescription>
                  Content you have submitted for review.
                </CardDescription>
              </div>
              <Badge variant={submitted > 0 ? "accent" : "outline"}>
                {submitted} submitted
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            {mySubmissions.length === 0 ? (
              <div className="rounded-md border border-dashed border-line-strong px-4 py-8 text-center">
                <ClipboardCheck
                  aria-hidden="true"
                  className="mx-auto size-6 text-ink-muted"
                  strokeWidth={1.5}
                />
                <p className="mt-2 text-xs text-ink-muted">
                  Nothing is waiting for a review decision.
                </p>
                <Link
                  href="/content?status=SUBMITTED"
                  className="mt-3 inline-flex text-xs font-medium text-accent hover:text-accent-strong"
                >
                  View all submissions
                </Link>
              </div>
            ) : (
              <ul className="divide-y divide-line">
                {mySubmissions.map((content) => (
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
                        {content.brand.name} ·{" "}
                        {dateFormatter.format(content.updatedAt)}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {content.analysisRuns[0]?.overallScore !== null &&
                      content.analysisRuns[0]?.overallScore !== undefined ? (
                        <Badge variant="accent">
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
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <CardTitle>Recent Content</CardTitle>
                <CardDescription>
                  Your latest uploads and their newest analysis.
                </CardDescription>
              </div>
              <Link
                href="/content"
                className="text-xs font-medium text-accent hover:text-accent-strong"
              >
                All content
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {recentContents.length === 0 ? (
              <p className="rounded-md border border-dashed border-line-strong px-4 py-8 text-center text-xs text-ink-muted">
                No content has been uploaded yet.
              </p>
            ) : (
              <ul className="divide-y divide-line">
                {recentContents.map((content) => {
                  const latestRun = content.analysisRuns[0] ?? null;

                  return (
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
                          {content.brand.name} ·{" "}
                          {dateFormatter.format(content.createdAt)}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <Badge
                          variant={
                            CONTENT_STATUS_VARIANTS[content.status] ?? "neutral"
                          }
                        >
                          {CONTENT_STATUS_LABELS[content.status] ?? content.status}
                        </Badge>
                        {latestRun?.overallScore !== null &&
                        latestRun?.overallScore !== undefined ? (
                          <Badge variant="accent">
                            {latestRun.overallScore}
                          </Badge>
                        ) : null}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6 min-w-0">
        <CardHeader>
          <CardTitle>What&apos;s Next</CardTitle>
          <CardDescription>
            Quick actions to move your work forward.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-3">
            <Link
              href="/content/new"
              className="rounded-lg border border-line bg-surface p-4 transition-colors hover:border-line-strong hover:bg-surface-muted"
            >
              <Upload className="size-5 text-ink-muted" strokeWidth={1.5} />
              <p className="mt-2 font-medium text-ink">Upload New Content</p>
              <p className="mt-1 text-xs text-ink-muted">
                Start a new analysis run
              </p>
            </Link>
            <Link
              href="/content?status=CHANGES_REQUESTED"
              className="rounded-lg border border-line bg-surface p-4 transition-colors hover:border-line-strong hover:bg-surface-muted"
            >
              <ClipboardCheck className="size-5 text-ink-muted" strokeWidth={1.5} />
              <p className="mt-2 font-medium text-ink">Address Requested Changes</p>
              <p className="mt-1 text-xs text-ink-muted">
                {changesRequested} awaiting another pass
              </p>
            </Link>
            <Link
              href="/content?status=SUBMITTED"
              className="rounded-lg border border-line bg-surface p-4 transition-colors hover:border-line-strong hover:bg-surface-muted"
            >
              <ArrowRight className="size-5 text-ink-muted" strokeWidth={1.5} />
              <p className="mt-2 font-medium text-ink">Track Submissions</p>
              <p className="mt-1 text-xs text-ink-muted">
                {submitted} waiting for decision
              </p>
            </Link>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
