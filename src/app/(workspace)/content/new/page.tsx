import { ArrowLeft, Building2 } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { UploadForm } from "@/components/content/upload-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { buttonStyles } from "@/components/ui/button";
import { hasPermission } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/guards";
import { db } from "@/lib/db";

export const metadata: Metadata = {
  title: "Upload content",
};

export default async function NewContentPage({
  searchParams,
}: {
  searchParams: Promise<{ brand?: string }>;
}) {
  const user = await requirePermission("content:create");
  const { brand: requestedBrandId } = await searchParams;
  const canManageBrands = hasPermission(user.role, "brand:manage");

  const brands = await db.brand.findMany({
    where: { status: { not: "ARCHIVED" } },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  return (
    <>
      <PageHeader
        eyebrow="Content intelligence"
        title="Upload content"
        description="VETTO extracts text and visual evidence, runs deterministic brand checks, and prepares the asset for human review."
        actions={
          <Link
            href="/content"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-ink-soft hover:text-ink"
          >
            <ArrowLeft
              aria-hidden="true"
              className="size-3.5"
              strokeWidth={1.75}
            />
            Back to content
          </Link>
        }
      />

      {brands.length === 0 ? (
        <EmptyState
          icon={Building2}
          title="Create a brand first"
          description="Every piece of content is analyzed against a brand profile and its rules. Create a brand before uploading content."
          action={
            canManageBrands ? (
              <Link
                href="/brands/new"
                className={buttonStyles({ variant: "primary" })}
              >
                Create a brand
              </Link>
            ) : undefined
          }
        />
      ) : (
        <Card className="max-w-4xl">
          <CardHeader>
            <CardTitle>New content</CardTitle>
            <CardDescription>
              Upload one file at a time. Extraction and deterministic analysis
              run automatically after the file is stored.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <UploadForm
              brands={brands}
              defaultBrandId={
                requestedBrandId &&
                brands.some((brand) => brand.id === requestedBrandId)
                  ? requestedBrandId
                  : undefined
              }
            />
          </CardContent>
        </Card>
      )}
    </>
  );
}
