import {
  ArrowLeft,
  Image as ImageIcon,
  Palette,
  ShieldCheck,
  Type,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import {
  AddColorForm,
  AddFontForm,
  AddRuleForm,
  AssetUploadForm,
  BrandBasicsForm,
  BrandProfileForm,
  ConfirmSubmitButton,
} from "@/components/brands/brand-forms";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { hasPermission } from "@/lib/auth/permissions";
import { requireUser } from "@/lib/auth/guards";
import { getCurrentUser } from "@/lib/auth/session";
import {
  deleteAssetAction,
  deleteColorAction,
  deleteFontAction,
  deleteRuleAction,
  setAssetApprovalAction,
  toggleRuleAction,
} from "@/lib/brands/actions";
import {
  approvalStatusLabels,
  assetKindLabels,
  brandStatusLabels,
  ruleCategoryLabels,
  ruleTypeLabels,
  severityLabels,
} from "@/lib/brands/labels";
import { db } from "@/lib/db";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const user = await getCurrentUser();

  if (!user) {
    return { title: "Brand" };
  }

  const brand = await db.brand.findUnique({
    where: { id },
    select: { name: true },
  });

  return { title: brand ? brand.name : "Brand" };
}

function statusVariant(status: string) {
  if (status === "ACTIVE") {
    return "success" as const;
  }

  if (status === "DRAFT") {
    return "warning" as const;
  }

  return "outline" as const;
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

function approvalVariant(status: string) {
  if (status === "APPROVED") {
    return "success" as const;
  }

  if (status === "REJECTED") {
    return "danger" as const;
  }

  return "warning" as const;
}

const dateFormatter = new Intl.DateTimeFormat("en", {
  dateStyle: "medium",
});

function DetailField({
  label,
  value,
}: {
  label: string;
  value: string | null | undefined;
}) {
  return (
    <div>
      <dt className="text-[10px] font-medium uppercase tracking-[0.16em] text-ink-muted">
        {label}
      </dt>
      <dd className="mt-1 text-sm leading-6 text-ink">
        {value || <span className="text-ink-muted">Not documented</span>}
      </dd>
    </div>
  );
}

export default async function BrandDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const canManage = hasPermission(user.role, "brand:manage");

  const brand = await db.brand.findUnique({
    where: { id },
    include: {
      profile: true,
      colors: {
        orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
      },
      fonts: { orderBy: { createdAt: "asc" } },
      rules: { orderBy: [{ createdAt: "asc" }] },
      assets: { orderBy: { createdAt: "desc" } },
      _count: { select: { contents: true } },
    },
  });

  if (!brand) {
    notFound();
  }

  return (
    <>
      <PageHeader
        eyebrow="Brand intelligence"
        title={brand.name}
        description={
          brand.description ??
          "This brand has no short description yet. Add brand intelligence so analysis has a source of truth."
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/brands"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-ink-soft hover:text-ink"
            >
              <ArrowLeft
                aria-hidden="true"
                className="size-3.5"
                strokeWidth={1.75}
              />
              All brands
            </Link>
            {brand.isDemo ? <Badge variant="info">Demo</Badge> : null}
            <Badge variant={statusVariant(brand.status)}>
              {brandStatusLabels[brand.status]}
            </Badge>
            <Badge variant="outline">{brand._count.contents} content</Badge>
          </div>
        }
      />

      {!canManage ? (
        <p className="mb-6 rounded-md border border-line bg-surface-muted px-4 py-3 text-xs leading-5 text-ink-soft">
          Your role can view brand intelligence and analysis findings, but only
          admins can change brand configuration.
        </p>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Identity</CardTitle>
            <CardDescription>
              Official name, URL slug, and lifecycle status for{" "}
              <span className="font-mono text-[11px]">/{brand.slug}</span>.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {canManage ? (
              <BrandBasicsForm
                brand={{
                  id: brand.id,
                  name: brand.name,
                  slug: brand.slug,
                  description: brand.description,
                  status: brand.status,
                }}
              />
            ) : (
              <dl className="grid gap-5 sm:grid-cols-2">
                <DetailField label="Name" value={brand.name} />
                <DetailField label="Slug" value={brand.slug} />
                <DetailField label="Status" value={brandStatusLabels[brand.status]} />
                <DetailField
                  label="Updated"
                  value={dateFormatter.format(brand.updatedAt)}
                />
                <div className="sm:col-span-2">
                  <DetailField label="Description" value={brand.description} />
                </div>
              </dl>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Brand intelligence</CardTitle>
            <CardDescription>
              Voice, personality, and visual direction used as context for rule
              and AI-assisted analysis.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {canManage ? (
              <BrandProfileForm brandId={brand.id} profile={brand.profile} />
            ) : (
              <dl className="grid gap-5">
                <DetailField
                  label="Narrative"
                  value={brand.profile?.description}
                />
                <DetailField
                  label="Personality"
                  value={brand.profile?.personality.join(", ")}
                />
                <DetailField label="Tone" value={brand.profile?.tone} />
                <DetailField
                  label="Visual style"
                  value={brand.profile?.visualStyle}
                />
                <DetailField
                  label="Imagery style"
                  value={brand.profile?.imageryStyle}
                />
                <DetailField
                  label="Design direction"
                  value={brand.profile?.designDirection}
                />
              </dl>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-start gap-3">
              <Palette
                aria-hidden="true"
                className="mt-0.5 size-4 shrink-0 text-ink-muted"
                strokeWidth={1.75}
              />
              <div>
                <CardTitle>Color palette</CardTitle>
                <CardDescription>
                  Documented brand colors. Visual checks compare dominant
                  content colors against this palette.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {brand.colors.length === 0 ? (
              <p className="rounded-md border border-dashed border-line-strong px-4 py-6 text-center text-xs text-ink-muted">
                No colors documented yet.
              </p>
            ) : (
              <ul className="divide-y divide-line">
                {brand.colors.map((color) => (
                  <li
                    key={color.id}
                    className="flex items-start justify-between gap-3 py-3 first:pt-0"
                  >
                    <div className="flex min-w-0 items-start gap-3">
                      <span
                        aria-hidden="true"
                        className="mt-0.5 size-8 shrink-0 rounded-md border border-line-strong"
                        style={{ backgroundColor: color.hex }}
                      />
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-medium text-ink">
                            {color.name ?? "Unnamed color"}
                          </p>
                          <code className="rounded bg-surface-strong px-1.5 py-0.5 font-mono text-[10px] text-ink-soft">
                            {color.hex}
                          </code>
                          {color.isPrimary ? (
                            <Badge variant="accent">Primary</Badge>
                          ) : null}
                        </div>
                        {color.usage ? (
                          <p className="mt-0.5 text-xs text-ink-muted">
                            {color.usage}
                          </p>
                        ) : null}
                      </div>
                    </div>
                    {canManage ? (
                      <form action={deleteColorAction}>
                        <input type="hidden" name="brandId" value={brand.id} />
                        <input type="hidden" name="colorId" value={color.id} />
                        <ConfirmSubmitButton
                          variant="ghost"
                          size="sm"
                          confirmMessage={`Remove ${color.name ?? color.hex} from the palette?`}
                        >
                          Remove
                        </ConfirmSubmitButton>
                      </form>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}

            {canManage ? (
              <div className="mt-5">
                <AddColorForm brandId={brand.id} />
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-start gap-3">
              <Type
                aria-hidden="true"
                className="mt-0.5 size-4 shrink-0 text-ink-muted"
                strokeWidth={1.75}
              />
              <div>
                <CardTitle>Typography</CardTitle>
                <CardDescription>
                  Approved typefaces. Typography extraction is compared against
                  this list with appropriate confidence.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {brand.fonts.length === 0 ? (
              <p className="rounded-md border border-dashed border-line-strong px-4 py-6 text-center text-xs text-ink-muted">
                No fonts documented yet.
              </p>
            ) : (
              <ul className="divide-y divide-line">
                {brand.fonts.map((font) => (
                  <li
                    key={font.id}
                    className="flex items-start justify-between gap-3 py-3 first:pt-0"
                  >
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-display text-base text-ink">
                          {font.name}
                        </p>
                        <Badge
                          variant={font.isApproved ? "success" : "neutral"}
                        >
                          {font.isApproved ? "Approved" : "Unapproved"}
                        </Badge>
                      </div>
                      {font.usage ? (
                        <p className="mt-0.5 text-xs text-ink-muted">
                          {font.usage}
                        </p>
                      ) : null}
                    </div>
                    {canManage ? (
                      <form action={deleteFontAction}>
                        <input type="hidden" name="brandId" value={brand.id} />
                        <input type="hidden" name="fontId" value={font.id} />
                        <ConfirmSubmitButton
                          variant="ghost"
                          size="sm"
                          confirmMessage={`Remove ${font.name}?`}
                        >
                          Remove
                        </ConfirmSubmitButton>
                      </form>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}

            {canManage ? (
              <div className="mt-5">
                <AddFontForm brandId={brand.id} />
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader>
          <div className="flex items-start gap-3">
            <ShieldCheck
              aria-hidden="true"
              className="mt-0.5 size-4 shrink-0 text-ink-muted"
              strokeWidth={1.75}
            />
            <div>
              <CardTitle>Governance rules</CardTitle>
              <CardDescription>
                Deterministic checks run against active rules. Every finding
                links back to the rule that produced it.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {brand.rules.length === 0 ? (
            <p className="rounded-md border border-dashed border-line-strong px-4 py-6 text-center text-xs text-ink-muted">
              No rules configured. Analysis will report no rule-based findings.
            </p>
          ) : (
            <ul className="space-y-3">
              {brand.rules.map((rule) => (
                <li
                  key={rule.id}
                  className="rounded-md border border-line bg-surface-muted p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-medium text-ink">
                          {rule.name}
                        </p>
                        <Badge variant={severityVariant(rule.severity)}>
                          {severityLabels[rule.severity]}
                        </Badge>
                        <Badge variant="outline">
                          {ruleCategoryLabels[rule.category]}
                        </Badge>
                        <Badge variant="neutral">
                          {ruleTypeLabels[rule.ruleType]}
                        </Badge>
                        <Badge variant={rule.isActive ? "success" : "neutral"}>
                          {rule.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </div>
                      <p className="mt-1 max-w-3xl text-xs leading-5 text-ink-soft">
                        {rule.description}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {rule.keyword ? (
                          <code className="rounded bg-surface px-2 py-1 font-mono text-[10px] text-ink-soft">
                            phrase: {rule.keyword}
                          </code>
                        ) : null}
                        {rule.pattern ? (
                          <code className="rounded bg-surface px-2 py-1 font-mono text-[10px] text-ink-soft">
                            pattern: {rule.pattern}
                          </code>
                        ) : null}
                      </div>
                    </div>

                    {canManage ? (
                      <div className="flex shrink-0 items-center gap-2">
                        <form action={toggleRuleAction}>
                          <input
                            type="hidden"
                            name="brandId"
                            value={brand.id}
                          />
                          <input type="hidden" name="ruleId" value={rule.id} />
                          <input
                            type="hidden"
                            name="isActive"
                            value={rule.isActive ? "false" : "true"}
                          />
                          <Button type="submit" variant="secondary" size="sm">
                            {rule.isActive ? "Disable" : "Enable"}
                          </Button>
                        </form>
                        <form action={deleteRuleAction}>
                          <input
                            type="hidden"
                            name="brandId"
                            value={brand.id}
                          />
                          <input type="hidden" name="ruleId" value={rule.id} />
                          <ConfirmSubmitButton
                            variant="ghost"
                            size="sm"
                            confirmMessage={`Delete the rule “${rule.name}”? Existing findings keep their historical evidence.`}
                          >
                            Delete
                          </ConfirmSubmitButton>
                        </form>
                      </div>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}

          {canManage ? (
            <div className="mt-5">
              <AddRuleForm brandId={brand.id} />
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <div className="flex items-start gap-3">
            <ImageIcon
              aria-hidden="true"
              className="mt-0.5 size-4 shrink-0 text-ink-muted"
              strokeWidth={1.75}
            />
            <div>
              <CardTitle>Approved assets</CardTitle>
              <CardDescription>
                Logos and imagery used for visual comparison. Only approved
                assets should be treated as canonical.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {brand.assets.length === 0 ? (
            <p className="rounded-md border border-dashed border-line-strong px-4 py-6 text-center text-xs text-ink-muted">
              No assets uploaded yet.
            </p>
          ) : (
            <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {brand.assets.map((asset) => {
                const isImage = asset.mimeType?.startsWith("image/");

                return (
                  <li
                    key={asset.id}
                    className="overflow-hidden rounded-md border border-line bg-surface"
                  >
                    <div className="flex aspect-[4/3] items-center justify-center bg-surface-muted p-3">
                      {isImage ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={`/api/brand-assets/${asset.id}`}
                          alt={asset.name}
                          loading="lazy"
                          className="max-h-full max-w-full object-contain"
                        />
                      ) : (
                        <ImageIcon
                          aria-hidden="true"
                          className="size-6 text-ink-muted"
                          strokeWidth={1.5}
                        />
                      )}
                    </div>
                    <div className="space-y-3 p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-ink">
                            {asset.name}
                          </p>
                          <p className="mt-0.5 text-[11px] text-ink-muted">
                            {assetKindLabels[asset.kind]}
                            {asset.variant ? ` · ${asset.variant}` : ""}
                          </p>
                        </div>
                        <Badge variant={approvalVariant(asset.approvalStatus)}>
                          {approvalStatusLabels[asset.approvalStatus]}
                        </Badge>
                      </div>

                      {asset.backgroundContext ? (
                        <p className="text-[11px] leading-5 text-ink-muted">
                          {asset.backgroundContext}
                        </p>
                      ) : null}

                      {canManage ? (
                        <div className="flex flex-wrap items-center gap-1.5">
                          {asset.approvalStatus !== "APPROVED" ? (
                            <form action={setAssetApprovalAction}>
                              <input
                                type="hidden"
                                name="assetId"
                                value={asset.id}
                              />
                              <input
                                type="hidden"
                                name="brandId"
                                value={brand.id}
                              />
                              <input
                                type="hidden"
                                name="approvalStatus"
                                value="APPROVED"
                              />
                              <Button
                                type="submit"
                                variant="secondary"
                                size="sm"
                              >
                                Approve
                              </Button>
                            </form>
                          ) : null}
                          {asset.approvalStatus !== "REJECTED" ? (
                            <form action={setAssetApprovalAction}>
                              <input
                                type="hidden"
                                name="assetId"
                                value={asset.id}
                              />
                              <input
                                type="hidden"
                                name="brandId"
                                value={brand.id}
                              />
                              <input
                                type="hidden"
                                name="approvalStatus"
                                value="REJECTED"
                              />
                              <Button type="submit" variant="ghost" size="sm">
                                Reject
                              </Button>
                            </form>
                          ) : null}
                          <form action={deleteAssetAction}>
                            <input
                              type="hidden"
                              name="assetId"
                              value={asset.id}
                            />
                            <input
                              type="hidden"
                              name="brandId"
                              value={brand.id}
                            />
                            <ConfirmSubmitButton
                              variant="ghost"
                              size="sm"
                              confirmMessage={`Delete the asset “${asset.name}”?`}
                            >
                              Delete
                            </ConfirmSubmitButton>
                          </form>
                        </div>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          {canManage ? (
            <div className="mt-5">
              <AssetUploadForm brandId={brand.id} />
            </div>
          ) : null}
        </CardContent>
      </Card>
    </>
  );
}

