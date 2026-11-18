import "server-only";

import { Prisma } from "@prisma/client";
import type { RuleCategory, Severity } from "@prisma/client";

import { recordAudit } from "@/lib/audit";
import { analyzeWithAi, isAiConfigured } from "@/lib/analysis/ai";
import {
  analyzeDeterministic,
  computeOverallScore,
  type DraftFinding,
  type ScoreSet,
} from "@/lib/analysis/deterministic";
import {
  analyzeVisualQuality,
  detectApprovedLogo,
  type LogoDetection,
  type VisualAnalysis,
} from "@/lib/analysis/visual";
import { db } from "@/lib/db";
import type { ExtractionData } from "@/lib/extraction/types";
import { getStorageAdapter } from "@/lib/storage";

export type AnalysisOutcome = {
  runId: string;
  scores: ScoreSet;
  overallScore: number | null;
  findingCount: number;
  aiStatus: "completed" | "failed" | "not-configured";
  aiError: string | null;
};

export async function runAnalysis(
  contentId: string,
  actorId: string,
): Promise<AnalysisOutcome> {
  const content = await db.content.findUnique({
    where: { id: contentId },
    include: {
      brand: {
        include: {
          profile: true,
          colors: true,
          fonts: true,
          rules: true,
          assets: {
            where: { kind: "LOGO", approvalStatus: "APPROVED" },
          },
        },
      },
      extraction: true,
    },
  });

  if (!content) {
    throw new Error("Content not found.");
  }

  if (content.status === "SUBMITTED" || content.status === "APPROVED") {
    throw new Error(
      "This content is locked by its review state and cannot be re-analyzed.",
    );
  }

  if (content.status === "PROCESSING" || content.status === "ANALYZING") {
    throw new Error("This content is already being processed.");
  }

  if (!content.extraction || content.extraction.status !== "COMPLETED") {
    throw new Error("Extraction must complete before analysis can run.");
  }

  const extractionData = content.extraction.data as ExtractionData | null;
  const extraction = {
    text: content.extraction.text ?? "",
    data: extractionData,
  };

  const run = await db.$transaction(async (transaction) => {
    const claimed = await transaction.content.updateMany({
      where: {
        id: content.id,
        status: {
          notIn: ["PROCESSING", "ANALYZING", "SUBMITTED", "APPROVED"],
        },
      },
      data: { status: "ANALYZING" },
    });

    if (claimed.count === 0) {
      const latest = await transaction.content.findUnique({
        where: { id: content.id },
        select: { status: true },
      });

      if (latest?.status === "SUBMITTED" || latest?.status === "APPROVED") {
        throw new Error(
          "This content is locked by its review state and cannot be re-analyzed.",
        );
      }

      throw new Error("This content is already being processed.");
    }

    return transaction.analysisRun.create({
      data: {
        contentId: content.id,
        brandId: content.brandId,
        status: "RUNNING",
        engineVersion: "deterministic-v1",
        promptVersion: isAiConfigured() ? "ai-brand-review-v1" : null,
      },
    });
  });

  try {
    let visual: VisualAnalysis | null = null;
    let logo: LogoDetection | null = null;

    if (content.kind === "IMAGE") {
      const buffer = await getStorageAdapter().getObject(content.storageKey);
      visual = await analyzeVisualQuality(buffer);

      const logos: Array<{ id: string; name: string; buffer: Buffer }> = [];

      for (const asset of content.brand.assets) {
        try {
          logos.push({
            id: asset.id,
            name: asset.name,
            buffer: await getStorageAdapter().getObject(asset.storageKey),
          });
        } catch (error) {
          console.error("Approved logo could not be loaded", asset.id, error);
        }
      }

      logo = await detectApprovedLogo({
        contentBuffer: buffer,
        logos,
      });
    }

    const brandColors = content.brand.colors.filter(
      (color) => color.isApproved,
    );
    const brandFonts = content.brand.fonts
      .filter((font) => font.isApproved)
      .map((font) => font.name);

    const deterministic = analyzeDeterministic({
      extraction,
      rules: content.brand.rules,
      brandColors,
      brandFonts,
      visual,
      logo,
      approvedLogoCount: content.brand.assets.length,
      extractionNotes: extractionData?.notes ?? [],
    });

    let aiResult: Awaited<ReturnType<typeof analyzeWithAi>> | null = null;
    let aiError: string | null = null;

    if (isAiConfigured() && extraction.text.trim().length > 0) {
      try {
        aiResult = await analyzeWithAi({
          brand: {
            name: content.brand.name,
            description: content.brand.description,
            profile: content.brand.profile,
            colors: brandColors,
            fonts: brandFonts,
          },
          extraction,
          deterministicFindings: deterministic.findings,
        });
      } catch (error) {
        aiError =
          error instanceof Error ? error.message : "AI analysis failed.";
        console.error("AI analysis failed", error);
      }
    }

    const aiFindings: DraftFinding[] =
      aiResult?.status === "completed" ? aiResult.findings : [];
    const allFindings = [...deterministic.findings, ...aiFindings];
    const scores: ScoreSet = {
      ...deterministic.scores,
      brandVibe:
        aiResult?.status === "completed"
          ? (aiResult.brandVibeScore ?? null)
          : null,
    };
    const overallScore = computeOverallScore(scores);
    const aiStatus =
      aiResult?.status === "completed"
        ? "completed"
        : aiError
          ? "failed"
          : "not-configured";

    const metadata = {
      ...deterministic.metadata,
      extraction: {
        kind: content.kind,
        pages: extractionData?.pages ?? null,
        ocrConfidence: extractionData?.ocrConfidence ?? null,
        width: extractionData?.width ?? null,
        height: extractionData?.height ?? null,
        dominantColors: extractionData?.dominantColors ?? [],
        textLength: extraction.text.length,
      },
      scoring: {
        weights: {
          brandIdentity: 0.3,
          visualQuality: 0.2,
          brandVibe: 0.15,
          content: 0.2,
          compliance: 0.15,
        },
        unavailable: Object.entries(scores)
          .filter(([, score]) => score === null)
          .map(([key]) => key),
      },
      ai: {
        status: aiStatus,
        model: aiResult?.status === "completed" ? aiResult.model : null,
        summary:
          aiResult?.status === "completed" ? aiResult.summary : null,
        brandVibeRationale:
          aiResult?.status === "completed"
            ? aiResult.brandVibeRationale
            : null,
        error: aiError,
      },
    };

    const findingRows: Prisma.FindingCreateManyInput[] = allFindings.map(
      (finding) => ({
        analysisRunId: run.id,
        ruleId: finding.ruleId,
        category: finding.category as RuleCategory,
        source: finding.source,
        severity: finding.severity as Severity,
        title: finding.title,
        description: finding.description,
        recommendation: finding.recommendation,
        evidence:
          finding.evidence === null
            ? Prisma.JsonNull
            : (finding.evidence as Prisma.InputJsonValue),
        confidence: finding.confidence,
        status: "OPEN",
      }),
    );

    await db.$transaction(async (transaction) => {
      if (findingRows.length > 0) {
        await transaction.finding.createMany({ data: findingRows });
      }

      await transaction.analysisRun.update({
        where: { id: run.id },
        data: {
          status: "COMPLETED",
          brandIdentityScore: scores.brandIdentity,
          visualQualityScore: scores.visualQuality,
          brandVibeScore: scores.brandVibe,
          contentScore: scores.content,
          complianceScore: scores.compliance,
          overallScore,
          deterministicCompletedAt: new Date(),
          aiCompletedAt:
            aiStatus === "completed" ? new Date() : null,
          metadata: metadata as Prisma.InputJsonValue,
          error: aiError,
        },
      });

      await transaction.content.update({
        where: { id: content.id },
        data: { status: "REVIEW_READY" },
      });
    });

    await recordAudit({
      actorId,
      action: "content.analysis_completed",
      entityType: "AnalysisRun",
      entityId: run.id,
      contentId: content.id,
      brandId: content.brandId,
      metadata: {
        overallScore,
        findingCount: allFindings.length,
        aiStatus,
      },
    });

    return {
      runId: run.id,
      scores,
      overallScore,
      findingCount: allFindings.length,
      aiStatus,
      aiError,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Analysis failed.";

    await db.analysisRun.update({
      where: { id: run.id },
      data: { status: "FAILED", error: message },
    });

    await db.content.update({
      where: { id: content.id },
      data: { status: "FAILED" },
    });

    await recordAudit({
      actorId,
      action: "content.analysis_failed",
      entityType: "AnalysisRun",
      entityId: run.id,
      contentId: content.id,
      brandId: content.brandId,
      metadata: { error: message },
    });

    throw new Error(message);
  }
}
