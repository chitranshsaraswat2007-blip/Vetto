import type { ReactNode } from "react";

import { AppShell } from "@/components/layout/app-shell";
import { requireUser } from "@/lib/auth/guards";

export const instant = false;

export default async function WorkspaceLayout({
  children,
}: {
  children: ReactNode;
}) {
  const user = await requireUser();

  return <AppShell user={user}>{children}</AppShell>;
}
