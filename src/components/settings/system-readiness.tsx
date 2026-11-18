import "server-only";

import { AlertCircle, CheckCircle2, CircleDashed } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { db } from "@/lib/db";
import { getStorageStatus } from "@/lib/storage";

type CheckStatus = "ready" | "missing" | "error";

type ReadinessCheck = {
  label: string;
  description: string;
  envVar: string;
  status: CheckStatus;
};

async function isDatabaseReachable() {
  try {
    await db.$queryRaw`SELECT 1`;
    return true;
  } catch (error) {
    console.error("Database readiness check failed", error);
    return false;
  }
}

function StatusIcon({ status }: { status: CheckStatus }) {
  if (status === "ready") {
    return (
      <CheckCircle2
        aria-hidden="true"
        className="mt-0.5 size-4 shrink-0 text-success"
        strokeWidth={1.75}
      />
    );
  }

  if (status === "error") {
    return (
      <AlertCircle
        aria-hidden="true"
        className="mt-0.5 size-4 shrink-0 text-danger"
        strokeWidth={1.75}
      />
    );
  }

  return (
    <CircleDashed
      aria-hidden="true"
      className="mt-0.5 size-4 shrink-0 text-ink-muted"
      strokeWidth={1.75}
    />
  );
}

function StatusBadge({ status }: { status: CheckStatus }) {
  if (status === "ready") {
    return <Badge variant="success">Ready</Badge>;
  }

  if (status === "error") {
    return <Badge variant="danger">Unavailable</Badge>;
  }

  return <Badge variant="neutral">Not configured</Badge>;
}

function getChecks(databaseReady: boolean): ReadinessCheck[] {
  const storage = getStorageStatus();
  const aiConfigured = Boolean(process.env.AI_API_KEY);

  return [
    {
      label: "PostgreSQL database",
      description:
        "Stores users, roles, brands, content records, analysis runs, findings, reviews, and audit history.",
      envVar: "DATABASE_URL",
      status: databaseReady ? "ready" : "error",
    },
    {
      label: "Application URL",
      description:
        "The canonical public URL used for metadata and server-generated links.",
      envVar: "NEXT_PUBLIC_APP_URL",
      status: process.env.NEXT_PUBLIC_APP_URL ? "ready" : "missing",
    },
    {
      label: "Object storage",
      description:
        storage.configured && storage.provider === "local"
          ? "Local development disk is active. Configure S3-compatible storage before production uploads."
          : "Stores uploaded content and approved brand assets independently of the application runtime.",
      envVar: "STORAGE_DRIVER · S3_*",
      status: storage.configured ? "ready" : "missing",
    },
    {
      label: "AI reasoning provider",
      description:
        "Used only for contextual analysis after deterministic checks complete. Failure must not block rule-based analysis.",
      envVar: "AI_API_KEY",
      status: aiConfigured ? "ready" : "missing",
    },
  ];
}

export async function SystemReadiness() {
  const databaseReady = await isDatabaseReachable();
  const checks = getChecks(databaseReady);

  return (
    <ul className="divide-y divide-line">
      {checks.map((check) => (
        <li
          key={check.label}
          className="flex items-start justify-between gap-4 py-4 first:pt-0 last:pb-0"
        >
          <div className="flex items-start gap-3">
            <StatusIcon status={check.status} />
            <div>
              <p className="text-sm font-medium text-ink">{check.label}</p>
              <p className="mt-0.5 max-w-md text-xs leading-5 text-ink-muted">
                {check.description}
              </p>
              <code className="mt-1.5 inline-flex rounded bg-surface-muted px-1.5 py-0.5 text-[10px] text-ink-muted">
                {check.envVar}
              </code>
            </div>
          </div>
          <StatusBadge status={check.status} />
        </li>
      ))}
    </ul>
  );
}

export function SystemReadinessSkeleton() {
  return (
    <div aria-busy="true" className="space-y-4">
      <span className="sr-only">Checking system readiness</span>
      {[0, 1, 2, 3].map((item) => (
        <div
          key={item}
          aria-hidden="true"
          className="flex animate-pulse items-start justify-between gap-4 motion-reduce:animate-none"
        >
          <div className="flex flex-1 items-start gap-3">
            <div className="mt-0.5 size-4 rounded-full bg-surface-strong" />
            <div className="flex-1 space-y-2">
              <div className="h-3 w-40 rounded bg-surface-strong" />
              <div className="h-2.5 w-full max-w-sm rounded bg-surface-muted" />
              <div className="h-2.5 w-28 rounded bg-surface-muted" />
            </div>
          </div>
          <div className="h-5 w-20 rounded-full bg-surface-strong" />
        </div>
      ))}
    </div>
  );
}
