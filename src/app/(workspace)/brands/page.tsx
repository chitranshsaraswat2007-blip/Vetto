import { ArrowRight, Fingerprint, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { buttonStyles } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { hasPermission } from "@/lib/auth/permissions";
import { requireUser } from "@/lib/auth/guards";
import { brandStatusLabels } from "@/lib/brands/labels";
import { db } from "@/lib/db";

export const metadata: Metadata = {
  title: "Brands",
};

function statusVariant(status: string) {
  if (status === "ACTIVE") {
    return "success" as const;
  }

  if (status === "DRAFT") {
    return "warning" as const;
  }

  return "outline" as const;
}

const dateFormatter = new Intl.DateTimeFormat("en", {
  dateStyle: "medium",
});

export default async function BrandsPage() {
  const user = await requireUser();
  const canManage = hasPermission(user.role, "brand:manage");

  const brands = await db.brand.findMany({
    orderBy: { updatedAt: "desc" },
    include: {
      colors: {
        orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
        take: 6,
      },
      _count: {
        select: { rules: true, contents: true, assets: true },
      },
    },
  });

  return (
    <>
      <PageHeader
        eyebrow="Brand intelligence"
        title="Brands"
        description="The identities, rules, and approved assets every piece of content is measured against."
        actions={
          canManage ? (
            <Link
              href="/brands/new"
              className={buttonStyles({ variant: "primary", size: "md" })}
            >
              <Plus aria-hidden="true" className="size-4" strokeWidth={1.75} />
              New brand
            </Link>
          ) : (
            <Badge variant="outline">Read-only access</Badge>
          )
        }
      />

      {brands.length === 0 ? (
        <EmptyState
          icon={Fingerprint}
          title="No brands configured"
          description="A brand profile anchors every review. Create a brand to define its identity, voice, visual system, approved assets, and rules."
          action={
            canManage ? (
              <Link
                href="/brands/new"
                className={buttonStyles({ variant: "primary" })}
              >
                Create the first brand
              </Link>
            ) : undefined
          }
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {brands.map((brand) => (
            <Card key={brand.id} className="flex flex-col">
              <CardHeader className="p-5 pb-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <CardTitle className="line-clamp-2 leading-snug">
                      <Link
                        href={`/brands/${brand.id}`}
                        className="hover:text-accent-strong"
                      >
                        {brand.name}
                      </Link>
                    </CardTitle>
                    <p className="mt-1 truncate font-mono text-[11px] text-ink-muted">
                      /{brand.slug}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-wrap justify-end gap-1.5">
                    {brand.isDemo ? (
                      <Badge variant="info">Demo</Badge>
                    ) : null}
                    <Badge variant={statusVariant(brand.status)}>
                      {brandStatusLabels[brand.status]}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="flex flex-1 flex-col p-5 pt-2">
                <p className="line-clamp-2 text-sm leading-6 text-ink-soft">
                  {brand.description ??
                    "No short description yet. Add brand intelligence to give analysis more context."}
                </p>

                <div className="mt-4 flex items-center gap-1.5">
                  {brand.colors.length > 0 ? (
                    brand.colors.map((color) => (
                      <span
                        key={color.id}
                        title={color.name ?? color.hex}
                        className="size-4 rounded-full border border-line-strong"
                        style={{ backgroundColor: color.hex }}
                      />
                    ))
                  ) : (
                    <span className="text-[11px] text-ink-muted">
                      No palette yet
                    </span>
                  )}
                </div>

                <div className="mt-auto flex items-end justify-between gap-3 pt-6">
                  <div className="text-[11px] leading-5 text-ink-muted">
                    <p>
                      {brand._count.rules} rules · {brand._count.assets} assets ·{" "}
                      {brand._count.contents} content
                    </p>
                    <p>Updated {dateFormatter.format(brand.updatedAt)}</p>
                  </div>
                  <Link
                    href={`/brands/${brand.id}`}
                    className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-accent hover:text-accent-strong"
                  >
                    Open
                    <ArrowRight
                      aria-hidden="true"
                      className="size-3.5"
                      strokeWidth={1.75}
                    />
                  </Link>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
