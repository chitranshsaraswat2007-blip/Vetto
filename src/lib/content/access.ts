import "server-only";

import { hasPermission } from "@/lib/auth/permissions";
import { db } from "@/lib/db";
import type { SessionUser } from "@/lib/auth/types";

export async function canViewContent(
  user: SessionUser,
  content: { id: string; uploadedById: string },
) {
  if (
    hasPermission(user.role, "content:view-all") ||
    content.uploadedById === user.id
  ) return true;

  if (user.role !== "SUPERVISOR") return false;
  const assignment = await db.supervisorAssignment.findUnique({
    where: { contentId: content.id },
    select: { supervisorId: true, content: { select: { status: true } } },
  });
  if (assignment?.supervisorId === user.id && assignment.content.status === "APPROVED") {
    return true;
  }

  const openEscalation = await db.supervisorEscalation.findFirst({
    where: {
      contentId: content.id,
      supervisorId: user.id,
      status: "OPEN",
      content: { status: "SUBMITTED" },
    },
    select: { id: true },
  });
  return Boolean(openEscalation);
}

export function canProcessContent(
  user: SessionUser,
  content: { uploadedById: string },
) {
  return (
    hasPermission(user.role, "content:analyze") &&
    (content.uploadedById === user.id ||
      hasPermission(user.role, "settings:manage"))
  );
}
