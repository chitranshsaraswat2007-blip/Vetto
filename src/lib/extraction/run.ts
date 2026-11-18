import "server-only";

import { recordAudit } from "@/lib/audit";
import { db } from "@/lib/db";
import { extractContentBuffer } from "@/lib/extraction/extract";
import { getStorageAdapter } from "@/lib/storage";

export async function runExtraction(contentId: string, actorId: string) {
  const content = await db.content.findUnique({
    where: { id: contentId },
    include: { extraction: true },
  });

  if (!content) {
    throw new Error("Content not found.");
  }

  await db.$transaction(async (transaction) => {
    const claimed = await transaction.content.updateMany({
      where: {
        id: content.id,
        status: {
          notIn: ["PROCESSING", "ANALYZING", "SUBMITTED", "APPROVED"],
        },
      },
      data: { status: "PROCESSING" },
    });

    if (claimed.count === 0) {
      const latest = await transaction.content.findUnique({
        where: { id: content.id },
        select: { status: true },
      });

      if (latest?.status === "SUBMITTED" || latest?.status === "APPROVED") {
        throw new Error(
          "This content is locked by its review state and cannot be re-extracted.",
        );
      }

      throw new Error("This content is already being processed.");
    }

    await transaction.extraction.upsert({
      where: { contentId: content.id },
      update: { status: "RUNNING", error: null },
      create: {
        contentId: content.id,
        status: "RUNNING",
        sourceType: content.kind,
      },
    });
  });

  try {
    const buffer = await getStorageAdapter().getObject(content.storageKey);
    const result = await extractContentBuffer({
      buffer,
      kind: content.kind,
    });

    await db.$transaction([
      db.extraction.update({
        where: { contentId: content.id },
        data: {
          status: "COMPLETED",
          text: result.text,
          data: result.data as never,
          error: null,
        },
      }),
      db.content.update({
        where: { id: content.id },
        data: { status: "UPLOADED" },
      }),
    ]);

    await recordAudit({
      actorId,
      action: "content.extraction_completed",
      entityType: "Content",
      entityId: content.id,
      contentId: content.id,
      brandId: content.brandId,
      metadata: {
        kind: content.kind,
        textLength: result.text.length,
      },
    });

    return result;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Extraction failed.";

    await db.$transaction([
      db.extraction.update({
        where: { contentId: content.id },
        data: { status: "FAILED", error: message },
      }),
      db.content.update({
        where: { id: content.id },
        data: { status: "FAILED" },
      }),
    ]);

    await recordAudit({
      actorId,
      action: "content.extraction_failed",
      entityType: "Content",
      entityId: content.id,
      contentId: content.id,
      brandId: content.brandId,
      metadata: { error: message },
    });

    throw new Error(message);
  }
}
