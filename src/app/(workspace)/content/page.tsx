import type { ContentStatus } from "@prisma/client";
import {
  ArrowRight,
  FileText,
  FileType,
  Image as ImageIcon,
  Upload,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { buttonStyles } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { hasPermission } from "@/lib/auth/permissions";
import { requireUser } from "@/lib/auth/guards";
import {
  CONTENT_KIND_LABELS,
  CONTENT_STATUS_LABELS,
  CONTENT_STATUS_VARIANTS,
} from "@/lib/content/constants";
import { db } from "@/lib/db";

export const metadata: Metadata = {
  title: "Content",
};

const dateFormatter = new Intl.DateTimeFormat("en", {
  dateStyle: "medium",
});

const statusFilters = Object.keys(CONTENT_STATUS_LABELS) as ContentStatus[];

function resolveStatusFilter(value: string | undefined) {
  return value && statusFilters.includes(value as ContentStatus)
    ? (value as ContentStatus)
    : null;
}

function KindIcon({ kind }: { kind: string }) {
  if (kind === "IMAGE") {
    return <ImageIcon aria-hidden="true" className="size-4" strokeWidth={1.6} />;
  }

  if (kind === "PDF") {
    return <FileText aria-hidden="true" className="size-4" strokeWidth={1.6} />;
  }

  return <FileType aria-hidden="true" className="size-4" strokeWidth={1.6} />;
}

export default async function ContentPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const user = await requireUser();
  const { status: requestedStatus } = await searchParams;
  const statusFilter = resolveStatusFilter(requestedStatus);
  const canCreate = hasPermission(user.role, "content:create");
  const canViewAll = hasPermission(user.role, "content:view-all");

  const contents = await db.content.findMany({
    where: {
      ...(user.role === "SUPERVISOR"
        ? { status: "APPROVED", supervisorAssignment: { is: { supervisorId: user.id } } }
        : canViewAll ? {} : { uploadedById: user.id }),
      ...(statusFilter ? { status: statusFilter } : {}),
    },
    orderBy: { createdAt: "desc" },
    include: {
      brand: { select: { id: true, name: true } },
      analysisRuns: {
        orderBy: { createdAt: "desc" },
        take: 1,
        include: { _count: { select: { findings: true } } },
      },
    },
  });

  return (
    <>
      <PageHeader
        eyebrow="Content intelligence"
        title="Content"
        description={user.role === "SUPERVISOR" ? "Manager-approved reviews assigned to you for secondary review." : "Uploaded brand content, its extraction state, and the latest analysis run for each asset."}
        actions={
          canCreate ? (
            <Link
              href="/content/new"
              className={buttonStyles({ variant: "primary", size: "md" })}
            >
              <Upload aria-hidden="true" className="size-4" strokeWidth={1.75} />
              Upload content
            </Link>
          ) : (
            <Badge variant="outline">Review access</Badge>
          )
        }
      />

      {statusFilter ? (
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <Badge variant="outline">
            Filtered: {CONTENT_STATUS_LABELS[statusFilter]}
          </Badge>
          <Link
            href="/content"
            className="text-xs font-medium text-accent hover:text-accent-strong"
          >
            Clear filter
          </Link>
        </div>
      ) : null}

      {contents.length === 0 ? (
        <EmptyState
          icon={Upload}
          title={
            statusFilter
              ? `No ${CONTENT_STATUS_LABELS[statusFilter].toLowerCase()} content`
              : canViewAll
                ? "No content uploaded yet"
                : "You have not uploaded content yet"
          }
          description={
            statusFilter
              ? "Nothing currently matches this status filter. Clear it to see the full content library."
              : canCreate
                ? "Upload an image, PDF, or DOCX. VETTO will extract text and visual evidence, run the brand's deterministic rules, and prepare it for review."
                : "Content uploaded by creators will appear here once it enters the workspace."
          }
          action={
            statusFilter ? (
              <Link
                href="/content"
                className={buttonStyles({ variant: "secondary" })}
              >
                Clear filter
              </Link>
            ) : canCreate ? (
              <Link
                href="/content/new"
                className={buttonStyles({ variant: "primary" })}
              >
                Upload the first asset
              </Link>
            ) : undefined
          }
        />
      ) : (
        <ul className="space-y-3">
          {contents.map((content) => {
            const latestRun = content.analysisRuns[0];

            return (
              <li key={content.id}>
                <Card className="p-4 sm:p-5">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex min-w-0 items-start gap-3">
                      <span className="flex size-10 shrink-0 items-center justify-center rounded-md border border-line bg-surface-muted text-ink-muted">
                        <KindIcon kind={content.kind} />
                      </span>
                      <div className="min-w-0">
                        <Link
                          href={`/content/${content.id}`}
                          className="truncate text-sm font-medium text-ink hover:text-accent-strong"
                        >
                          {content.title ?? content.originalFilename}
                        </Link>
                        <p className="mt-0.5 truncate text-xs text-ink-muted">
                          {content.brand.name} ·{" "}
                          {CONTENT_KIND_LABELS[content.kind] ?? content.kind} ·{" "}
                          {(content.fileSize / 1024 / 1024).toFixed(1)} MB
                        </p>
                        <p className="mt-0.5 text-[11px] text-ink-muted">
                          Uploaded {dateFormatter.format(content.createdAt)}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 sm:justify-end">
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
                        className="ml-1 inline-flex items-center gap-1 text-xs font-medium text-accent hover:text-accent-strong"
                      >
                        Open
                        <ArrowRight
                          aria-hidden="true"
                          className="size-3.5"
                          strokeWidth={1.75}
                        />
                      </Link>
                    </div>
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
