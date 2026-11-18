import "server-only";

import { redirect } from "next/navigation";

import {
  hasPermission,
  type Permission,
} from "@/lib/auth/permissions";
import { getCurrentUser } from "@/lib/auth/session";
import type { SessionUser } from "@/lib/auth/types";

export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  return user;
}

export async function requirePermission(
  permission: Permission,
): Promise<SessionUser> {
  const user = await requireUser();

  if (!hasPermission(user.role, permission)) {
    redirect("/forbidden");
  }

  return user;
}
