"use server";

import { revalidatePath } from "next/cache";

import { recordAudit } from "@/lib/audit";
import { requireUser } from "@/lib/auth/guards";
import { hasPermission } from "@/lib/auth/permissions";
import { canViewContent } from "@/lib/content/access";
import { db } from "@/lib/db";
import {
  findingStatuses,
  reviewDecisions,
  type FindingStatusValue,
  type ReviewActionState,
  type ReviewDecisionValue,
} from "@/lib/reviews/types";

function getString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function getOptionalString(formData: FormData, key: string) {
  const value = getString(formData, key);
  return value === "" ? undefined : value;
}

function revalidateReviewSurfaces(contentId: string) {
  revalidatePath("/reviews");
  revalidatePath("/content");
  revalidatePath(`/content/${contentId}`);
  revalidatePath("/dashboard");
}

export async function submitForReviewAction(
  _previousState: ReviewActionState,
  formData: FormData,
): Promise<ReviewActionState> {
  const user = await requireUser();
  const contentId = getString(formData, "contentId");
  const comment = getOptionalString(formData, "comment");

  if (!contentId) {
    return { error: "Content is missing." };
  }

  if (comment && comment.length > 2000) {
    return { error: "Review notes must be 2,000 characters or fewer." };
  }

  const content = await db.content.findUnique({
    where: { id: contentId },
    include: {
      analysisRuns: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });

  if (!content) {
    return { error: "Content not found." };
  }

  if (!(await canViewContent(user, content))) {
    return { error: "You do not have access to this content." };
  }

  const canSubmit =
    hasPermission(user.role, "content:submit") &&
    (content.uploadedById === user.id ||
      hasPermission(user.role, "settings:manage"));

  if (!canSubmit) {
    return { error: "You do not have permission to submit this content." };
  }

  if (
    content.status !== "REVIEW_READY" &&
    content.status !== "CHANGES_REQUESTED"
  ) {
    return {
      error: "Only review-ready content or content with requested changes can be submitted.",
    };
  }

  const latestRun = content.analysisRuns[0] ?? null;

  if (!latestRun || latestRun.status !== "COMPLETED") {
    return { error: "A completed analysis run is required before review." };
  }

  try {
    const submitted = await db.$transaction(async (transaction) => {
      const claimed = await transaction.content.updateMany({
        where: {
          id: content.id,
          status: { in: ["REVIEW_READY", "CHANGES_REQUESTED"] },
        },
        data: { status: "SUBMITTED" },
      });

      if (claimed.count === 0) {
        return false;
      }

      await transaction.review.create({
        data: {
          contentId: content.id,
          analysisRunId: latestRun.id,
          actorId: user.id,
          action: "SUBMITTED",
          comment,
        },
      });

      return true;
    });

    if (!submitted) {
      return {
        error:
          "Only review-ready content or content with requested changes can be submitted.",
      };
    }
  } catch (error) {
    console.error("Failed to submit content for review", error);
    return { error: "The content could not be submitted. Try again." };
  }

  await recordAudit({
    actorId: user.id,
    action: "content.submitted_for_review",
    entityType: "Content",
    entityId: content.id,
    brandId: content.brandId,
    contentId: content.id,
    metadata: {
      analysisRunId: latestRun.id,
      previousStatus: content.status,
      hasComment: Boolean(comment),
    },
  });

  revalidateReviewSurfaces(content.id);
  return { success: "Submitted for review." };
}

export async function reviewDecisionAction(
  _previousState: ReviewActionState,
  formData: FormData,
): Promise<ReviewActionState> {
  const user = await requireUser();
  const contentId = getString(formData, "contentId");
  const decision = getString(formData, "decision") as ReviewDecisionValue;
  const comment = getOptionalString(formData, "comment");

  if (!contentId) {
    return { error: "Content is missing." };
  }

  if (!reviewDecisions.includes(decision)) {
    return { error: "Choose a valid review decision." };
  }

  if (!hasPermission(user.role, "content:review")) {
    return { error: "You do not have permission to review content." };
  }

  if (comment && comment.length > 2000) {
    return { error: "Review notes must be 2,000 characters or fewer." };
  }

  if (decision === "CHANGES_REQUESTED" && (!comment || comment.length < 3)) {
    return {
      error: "Explain what needs to change before requesting changes.",
    };
  }

  const content = await db.content.findUnique({
    where: { id: contentId },
    include: {
      analysisRuns: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });

  if (!content) {
    return { error: "Content not found." };
  }

  if (content.status !== "SUBMITTED") {
    return { error: "Only submitted content can receive a review decision." };
  }

  const latestRun = content.analysisRuns[0] ?? null;

  try {
    const decided = await db.$transaction(async (transaction) => {
      const claimed = await transaction.content.updateMany({
        where: { id: content.id, status: "SUBMITTED" },
        data: { status: decision },
      });

      if (claimed.count === 0) {
        return false;
      }

      await transaction.review.create({
        data: {
          contentId: content.id,
          analysisRunId: latestRun?.id,
          actorId: user.id,
          action: decision,
          comment,
        },
      });

      return true;
    });

    if (!decided) {
      return { error: "Only submitted content can receive a review decision." };
    }
  } catch (error) {
    console.error("Failed to record review decision", error);
    return { error: "The decision could not be recorded. Try again." };
  }

  await recordAudit({
    actorId: user.id,
    action: decision === "APPROVED" ? "content.approved" : "content.changes_requested",
    entityType: "Content",
    entityId: content.id,
    brandId: content.brandId,
    contentId: content.id,
    metadata: {
      analysisRunId: latestRun?.id ?? null,
      previousStatus: content.status,
      comment,
    },
  });

  revalidateReviewSurfaces(content.id);
  return {
    success:
      decision === "APPROVED"
        ? "Content approved."
        : "Changes requested and sent back to the creator.",
  };
}

export async function addReviewCommentAction(
  _previousState: ReviewActionState,
  formData: FormData,
): Promise<ReviewActionState> {
  const user = await requireUser();
  const contentId = getString(formData, "contentId");
  const comment = getOptionalString(formData, "comment");

  if (!contentId) {
    return { error: "Content is missing." };
  }

  if (!comment || comment.length < 2) {
    return { error: "Write a comment before posting." };
  }

  if (comment.length > 2000) {
    return { error: "Comments must be 2,000 characters or fewer." };
  }

  const content = await db.content.findUnique({
    where: { id: contentId },
    include: {
      analysisRuns: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });

  if (!content) {
    return { error: "Content not found." };
  }

  if (!(await canViewContent(user, content))) {
    return { error: "You do not have access to this content." };
  }

  await db.review.create({
    data: {
      contentId: content.id,
      analysisRunId: content.analysisRuns[0]?.id,
      actorId: user.id,
      action: user.role === "SUPERVISOR" ? "SUPERVISOR_REVIEWED" : "COMMENTED",
      comment,
    },
  });

  await recordAudit({
    actorId: user.id,
    action: "content.review_comment",
    entityType: "Content",
    entityId: content.id,
    brandId: content.brandId,
    contentId: content.id,
    metadata: { comment },
  });

  revalidateReviewSurfaces(content.id);
  return { success: "Comment added to the review history." };
}

export async function assignSupervisorReviewAction(
  _previousState: ReviewActionState,
  formData: FormData,
): Promise<ReviewActionState> {
  const user = await requireUser();
  if (user.role !== "MANAGER" || !hasPermission(user.role, "review:assign")) {
    return { error: "Only a Manager can assign supervisor reviews." };
  }
  const contentId = getString(formData, "contentId");
  const supervisorId = getString(formData, "supervisorId");
  if (!contentId || !supervisorId) return { error: "Choose a Supervisor." };

  const [content, supervisor] = await Promise.all([
    db.content.findUnique({ where: { id: contentId }, select: { id: true, brandId: true, status: true } }),
    db.user.findUnique({ where: { id: supervisorId }, select: { id: true, role: true, isActive: true } }),
  ]);
  if (!content || content.status !== "APPROVED") {
    return { error: "Only Manager-approved content can be assigned for a secondary review." };
  }
  if (!supervisor || supervisor.role !== "SUPERVISOR" || !supervisor.isActive) {
    return { error: "Choose an active Supervisor account." };
  }

  await db.supervisorAssignment.upsert({
    where: { contentId },
    create: { contentId, supervisorId, assignedById: user.id },
    update: { supervisorId, assignedById: user.id },
  });
  await recordAudit({
    actorId: user.id,
    action: "content.supervisor_review_assigned",
    entityType: "SupervisorAssignment",
    entityId: contentId,
    brandId: content.brandId,
    contentId,
    metadata: { supervisorId },
  });
  revalidateReviewSurfaces(contentId);
  return { success: "Supervisor review assigned." };
}

export async function updateFindingStatusAction(
  _previousState: ReviewActionState,
  formData: FormData,
): Promise<ReviewActionState> {
  const user = await requireUser();

  if (!hasPermission(user.role, "finding:update")) {
    return { error: "You do not have permission to update findings." };
  }

  const findingId = getString(formData, "findingId");
  const status = getString(formData, "status");
  const note = getOptionalString(formData, "note");

  if (!findingId || !findingStatuses.includes(status as FindingStatusValue)) {
    return { error: "Choose a valid finding status." };
  }

  if (note && note.length > 500) {
    return { error: "Reasons must be 500 characters or fewer." };
  }

  // Dismissing a finding is a waiver, so it always needs a recorded reason.
  if (status === "DISMISSED" && (!note || note.length < 3)) {
    return { error: "Record why this finding is being dismissed." };
  }

  const finding = await db.finding.findUnique({
    where: { id: findingId },
    include: {
      analysisRun: {
        select: {
          id: true,
          contentId: true,
          brandId: true,
          content: { select: { id: true, uploadedById: true } },
        },
      },
    },
  });

  if (!finding) {
    return { error: "Finding not found." };
  }

  if (!(await canViewContent(user, finding.analysisRun.content))) {
    return { error: "You do not have access to this finding." };
  }

  await db.finding.update({
    where: { id: finding.id },
    data: { status: status as FindingStatusValue },
  });

  await recordAudit({
    actorId: user.id,
    action: "finding.status_updated",
    entityType: "Finding",
    entityId: finding.id,
    brandId: finding.analysisRun.brandId,
    contentId: finding.analysisRun.contentId,
    metadata: {
      analysisRunId: finding.analysisRun.id,
      previousStatus: finding.status,
      status,
      note: note ?? null,
      waiver: status === "DISMISSED",
    },
  });

  revalidateReviewSurfaces(finding.analysisRun.contentId);
  return { success: "Finding status updated." };
}
