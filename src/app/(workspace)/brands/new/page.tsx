import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { CreateBrandForm } from "@/components/brands/brand-forms";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { requirePermission } from "@/lib/auth/guards";

export const metadata: Metadata = {
  title: "New brand",
};

export default async function NewBrandPage() {
  await requirePermission("brand:manage");

  return (
    <>
      <PageHeader
        eyebrow="Brand intelligence"
        title="Create a brand"
        description="Start with the essentials. Colors, fonts, approved assets, and governance rules can be added from the brand workspace after creation."
        actions={
          <Link
            href="/brands"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-ink-soft hover:text-ink"
          >
            <ArrowLeft
              aria-hidden="true"
              className="size-3.5"
              strokeWidth={1.75}
            />
            Back to brands
          </Link>
        }
      />

      <Card className="max-w-4xl">
        <CardHeader>
          <CardTitle>Brand profile</CardTitle>
          <CardDescription>
            The slug is used in URLs. Brand intelligence is optional now and can
            be refined at any time.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CreateBrandForm />
        </CardContent>
      </Card>
    </>
  );
}
