import { ArrowRight, Users, Settings, Fingerprint, Shield } from "lucide-react";
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

export const metadata: Metadata = {
  title: "Admin Home",
};

const dateFormatter = new Intl.DateTimeFormat("en", {
  dateStyle: "medium",
});

export default async function AdminHomePage() {
  await requirePermission("settings:manage");

  const [
    totalUsers,
    roleCounts,
    activeBrands,
    activeRules,
    pendingReviews,
    recentUsers,
    usersThisWeek,
    findingGroups,
  ] = await Promise.all([
    db.user.count(),
    db.user.groupBy({
      by: ["role"],
      _count: { _all: true },
    }),
    db.brand.count({ where: { status: "ACTIVE" } }),
    db.brandRule.count({ where: { isActive: true } }),
    db.content.count({ where: { status: "SUBMITTED" } }),
    db.user.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
    }),
    db.user.findMany({
      where: { createdAt: { gte: weekStartUtc() } },
      select: { createdAt: true },
    }),
    db.$queryRaw<Array<{ ruleId: string | null; status: string; count: number }>>`
      WITH latest_runs AS (
        SELECT DISTINCT ON ("contentId") "id"
        FROM "AnalysisRun"
        WHERE "status" = 'COMPLETED'
        ORDER BY "contentId", "createdAt" DESC
      )
      SELECT f."ruleId" AS "ruleId", f."status"::text AS "status", COUNT(*)::int AS "count"
      FROM "Finding" f
      JOIN latest_runs latest ON latest."id" = f."analysisRunId"
      JOIN "BrandRule" rule ON rule."id" = f."ruleId" AND rule."isActive" = true
      JOIN "Brand" brand ON brand."id" = rule."brandId" AND brand."status" = 'ACTIVE'
      GROUP BY f."ruleId", f."status"
    `,
  ]);

  const roleStats = roleCounts.reduce((acc, r) => {
    acc[r.role] = r._count._all;
    return acc;
  }, {} as Record<string, number>);

  const stats = [
    {
      label: "Workspace Users",
      value: totalUsers,
      hint: `${roleStats.CREATOR ?? 0} Creators · ${roleStats.MANAGER ?? 0} Managers · ${roleStats.SUPERVISOR ?? 0} Supervisors`,
      href: "/users",
    },
    {
      label: "Active Brands",
      value: activeBrands,
      hint: "Brand profiles with rules",
      href: "/brands",
    },
    {
      label: "Active Rules",
      value: activeRules,
      hint: "Across all brand profiles",
      href: "/brands",
    },
    {
      label: "Awaiting Review",
      value: pendingReviews,
      hint: "Submitted content awaiting a decision",
      href: "/reviews?status=SUBMITTED",
    },
  ];

  const ruleFindingTotals = new Map<string, { total: number; waived: number }>();
  for (const group of findingGroups) {
    if (!group.ruleId) continue;
    const totals = ruleFindingTotals.get(group.ruleId) ?? { total: 0, waived: 0 };
    totals.total += group.count;
    if (group.status === "DISMISSED") totals.waived += group.count;
    ruleFindingTotals.set(group.ruleId, totals);
  }
  const unclearRuleSignals = [...ruleFindingTotals.entries()]
    .filter(([, totals]) => totals.total >= 3 && totals.waived >= 2)
    .sort((left, right) => right[1].waived - left[1].waived || right[1].total - left[1].total);
  const unclearRules = unclearRuleSignals.length > 0
    ? await db.brandRule.findMany({
        where: {
          id: { in: unclearRuleSignals.map(([ruleId]) => ruleId) },
          isActive: true,
        },
        select: {
          id: true,
          name: true,
          brandId: true,
          brand: { select: { name: true, status: true } },
        },
      })
    : [];
  const unclearRuleById = new Map(unclearRules.map((rule) => [rule.id, rule]));
  const activeUnclearRules = unclearRuleSignals
    .flatMap(([ruleId, totals]) => {
      const rule = unclearRuleById.get(ruleId);
      if (!rule?.brand || rule.brand.status !== "ACTIVE") return [];
      return [{
        ...rule,
        ...totals,
        waivedRate: Math.round((totals.waived / totals.total) * 100),
      }];
    });
  const unclearRulesForDisplay = activeUnclearRules.slice(0, 5);

  return (
    <>
      <PageHeader
        eyebrow="Admin"
        title="Workspace Administration"
        description="Manage users, brands, rules, and workspace settings."
        actions={
          <div className="flex items-center gap-2">
            <Link href="/users" className={buttonStyles({ variant: "secondary", size: "sm" })}>
              <Users className="size-3.5" strokeWidth={1.75} />
              Add User
            </Link>
            <Link href="/brands/new" className={buttonStyles({ variant: "primary", size: "sm" })}>
              <Fingerprint className="size-3.5" strokeWidth={1.75} />
              New Brand
            </Link>
          </div>
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
          title="Team composition"
          description="Active account structure by VETTO role."
          data={Object.entries(roleStats).map(([role, value]) => ({ label: role[0] + role.slice(1).toLowerCase(), value }))}
        />
        <WeekBarChart
          title="New workspace members"
          description="Accounts created on each day this week."
          data={weekSeries(usersThisWeek.map((item) => item.createdAt))}
        />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Card className="min-w-0">
          <CardHeader>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <CardTitle>User Roles</CardTitle>
                <CardDescription>
                  Distribution of roles across the workspace.
                </CardDescription>
              </div>
              <Link
                href="/users"
                className="text-xs font-medium text-accent hover:text-accent-strong"
              >
                Manage users
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            <dl className="divide-y divide-line">
              {([
                { key: "ADMIN", label: "Administrators", icon: Shield },
                { key: "MANAGER", label: "Managers", icon: Shield },
                { key: "SUPERVISOR", label: "Supervisors", icon: Shield },
                { key: "CREATOR", label: "Creators", icon: Shield },
              ] as const).map(({ key, label, icon: Icon }) => (
                <div
                  key={key}
                  className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0"
                >
                  <div className="flex items-center gap-2">
                    <Icon className="size-4 text-ink-muted" strokeWidth={1.5} />
                    <span className="text-xs text-ink-soft">{label}</span>
                  </div>
                  <Badge variant="outline">
                    {roleStats[key] ?? 0}
                  </Badge>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>

        <Card className="min-w-0">
          <CardHeader>
            <CardTitle>Recent Users</CardTitle>
            <CardDescription>
              Latest workspace members.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {recentUsers.length === 0 ? (
              <p className="rounded-md border border-dashed border-line-strong px-4 py-8 text-center text-xs text-ink-muted">
                No users yet.
              </p>
            ) : (
              <ul className="divide-y divide-line">
                {recentUsers.map((u) => (
                  <li
                    key={u.id}
                    className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-ink">{u.name}</p>
                      <p className="truncate text-[10px] text-ink-muted">{u.email}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <Badge variant="outline">
                        {u.role}
                      </Badge>
                      <span className="text-[10px] text-ink-muted">
                        {dateFormatter.format(u.createdAt)}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6 min-w-0">
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle>Rules to review for clarity</CardTitle>
              <CardDescription>
                Active rules with at least three findings and two or more currently dismissed findings.
                This is a review signal, not a conclusion that the rule is wrong.
              </CardDescription>
            </div>
            <Badge variant={activeUnclearRules.length > 0 ? "warning" : "outline"}>
              {activeUnclearRules.length} to review
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {unclearRulesForDisplay.length === 0 ? (
            <p className="rounded-md border border-dashed border-line-strong px-4 py-6 text-center text-xs text-ink-muted">
              No active rules meet the repeated-waiver threshold yet.
            </p>
          ) : (
            <ul className="divide-y divide-line">
              {unclearRulesForDisplay.map((rule) => (
                <li key={rule.id} className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-ink">{rule.name}</p>
                    <p className="mt-1 text-[10px] text-ink-muted">{rule.brand.name} · {rule.waived} of {rule.total} findings waived ({rule.waivedRate}%)</p>
                  </div>
                  <Link href={`/brands/${rule.brandId}`} className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-accent hover:text-accent-strong">
                    Review rule <ArrowRight aria-hidden="true" className="size-3.5" strokeWidth={1.75} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <div className="mt-6 grid gap-6 sm:grid-cols-3">
        <Link
          href="/users"
          className="rounded-lg border border-line bg-surface p-5 transition-colors hover:border-line-strong hover:bg-surface-muted"
        >
          <Users className="size-6 text-ink-muted" strokeWidth={1.5} />
          <p className="mt-2 font-medium text-ink">Manage Users</p>
          <p className="mt-1 text-xs text-ink-muted">
            Add, edit, deactivate workspace members
          </p>
        </Link>
        <Link
          href="/brands"
          className="rounded-lg border border-line bg-surface p-5 transition-colors hover:border-line-strong hover:bg-surface-muted"
        >
          <Fingerprint className="size-6 text-ink-muted" strokeWidth={1.5} />
          <p className="mt-2 font-medium text-ink">Manage Brands & Rules</p>
          <p className="mt-1 text-xs text-ink-muted">
            Profiles, colors, fonts, assets, rules
          </p>
        </Link>
        <Link
          href="/settings"
          className="rounded-lg border border-line bg-surface p-5 transition-colors hover:border-line-strong hover:bg-surface-muted"
        >
          <Settings className="size-6 text-ink-muted" strokeWidth={1.5} />
          <p className="mt-2 font-medium text-ink">Workspace Settings</p>
          <p className="mt-1 text-xs text-ink-muted">
            Storage, AI, runtime configuration
          </p>
        </Link>
      </div>
    </>
  );
}
