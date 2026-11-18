import "server-only";

import { db } from "@/lib/db";

type AuditInput = {
  actorId: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  brandId?: string | null;
  contentId?: string | null;
  metadata?: Record<string, unknown>;
};

export async function recordAudit(input: AuditInput) {
  try {
    await db.auditLog.create({
      data: {
        actorId: input.actorId,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId ?? null,
        brandId: input.brandId ?? null,
        contentId: input.contentId ?? null,
        metadata: input.metadata as never,
      },
    });
  } catch (error) {
    console.error("Failed to write audit log", error);
  }
}
