import { ShieldX } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { buttonStyles } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { requireUser } from "@/lib/auth/guards";
import { roleDescriptions, roleLabels } from "@/lib/auth/permissions";

export const metadata: Metadata = {
  title: "Access denied",
};

export default async function ForbiddenPage() {
  const user = await requireUser();

  return (
    <>
      <PageHeader
        eyebrow="Permissions"
        title="Access denied"
        description="This action is not available for your current role. Authorization is enforced on the server, not by hiding interface controls."
        actions={<Badge variant="danger">403</Badge>}
      />

      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-line-strong bg-surface/60 px-6 py-16 text-center">
        <div className="flex size-12 items-center justify-center rounded-md border border-line bg-surface text-danger shadow-card">
          <ShieldX aria-hidden="true" className="size-5" strokeWidth={1.5} />
        </div>
        <h2 className="mt-5 font-display text-xl text-ink">
          Your role cannot perform this action.
        </h2>
        <p className="mt-2 max-w-md text-sm leading-6 text-ink-soft">
          You are signed in as a{" "}
          <span className="font-medium text-ink">{roleLabels[user.role]}</span>.{" "}
          {roleDescriptions[user.role]}
        </p>
        <Link
          href="/dashboard"
          className={buttonStyles({ variant: "secondary", className: "mt-6" })}
        >
          Back to dashboard
        </Link>
      </div>
    </>
  );
}
