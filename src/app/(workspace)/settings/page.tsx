import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import {
  SystemReadiness,
  SystemReadinessSkeleton,
} from "@/components/settings/system-readiness";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { requirePermission } from "@/lib/auth/guards";
import { getAppUrl, getServerEnv } from "@/lib/env";

export const metadata: Metadata = {
  title: "Settings",
};

const runtimeLabels: Record<string, string> = {
  development: "Development",
  production: "Production",
  test: "Test",
};

export default async function SettingsPage() {
  await requirePermission("settings:manage");

  const env = getServerEnv();
  const appUrl = getAppUrl();

  const runtimeDetails = [
    { label: "Environment", value: runtimeLabels[env.NODE_ENV] ?? env.NODE_ENV },
    { label: "Application URL", value: appUrl },
    { label: "Data layer", value: "PostgreSQL · Prisma ORM" },
    { label: "Runtime", value: "Next.js App Router" },
  ];

  return (
    <>
      <PageHeader
        eyebrow="Configure"
        title="Settings"
        description="Operational checks for the VETTO workspace. Only configuration names and connection states are shown — never secret values."
      />

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader>
            <CardTitle>System readiness</CardTitle>
            <CardDescription>
              Live checks against the services VETTO depends on. Missing
              configuration is reported honestly, not simulated.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Suspense fallback={<SystemReadinessSkeleton />}>
              <SystemReadiness />
            </Suspense>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Runtime details</CardTitle>
            <CardDescription>
              Non-secret values for this deployment.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <dl className="divide-y divide-line">
              {runtimeDetails.map((detail) => (
                <div
                  key={detail.label}
                  className="flex flex-col gap-1 py-3 first:pt-0 last:pb-0"
                >
                  <dt className="text-[10px] font-medium uppercase tracking-[0.16em] text-ink-muted">
                    {detail.label}
                  </dt>
                  <dd className="break-words text-sm text-ink">
                    {detail.value}
                  </dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Where configuration lives</CardTitle>
          <CardDescription>
            Brand-specific settings stay with the brand record so analysis never
            depends on hard-coded rules.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="grid gap-4 sm:grid-cols-3">
            <li className="rounded-md border border-line bg-surface-muted p-4">
              <p className="text-sm font-medium text-ink">Brand intelligence</p>
              <p className="mt-1 text-xs leading-5 text-ink-soft">
                Identity, voice, visual direction, approved assets, and rules.
              </p>
              <Link
                href="/brands"
                className="mt-3 inline-flex text-xs font-medium text-accent hover:text-accent-strong"
              >
                Open brands
              </Link>
            </li>
            <li className="rounded-md border border-line bg-surface-muted p-4">
              <p className="text-sm font-medium text-ink">Content intake</p>
              <p className="mt-1 text-xs leading-5 text-ink-soft">
                Original files, extraction evidence, and analysis runs.
              </p>
              <Link
                href="/content"
                className="mt-3 inline-flex text-xs font-medium text-accent hover:text-accent-strong"
              >
                Open content
              </Link>
            </li>
            <li className="rounded-md border border-line bg-surface-muted p-4">
              <p className="text-sm font-medium text-ink">Review decisions</p>
              <p className="mt-1 text-xs leading-5 text-ink-soft">
                Submissions, approvals, change requests, and audit history.
              </p>
              <Link
                href="/reviews"
                className="mt-3 inline-flex text-xs font-medium text-accent hover:text-accent-strong"
              >
                Open reviews
              </Link>
            </li>
          </ul>
        </CardContent>
      </Card>
    </>
  );
}
