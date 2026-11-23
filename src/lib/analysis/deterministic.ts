import "server-only";

import {
  analyzePalette,
  type LogoDetection,
  type VisualAnalysis,
} from "@/lib/analysis/visual";
import { SEVERITY_WEIGHTS } from "@/lib/content/constants";
import type { ExtractionData } from "@/lib/extraction/types";

export type RuleInput = {
  id: string;
  name: string;
  category: string;
  ruleType: string;
  severity: string;
  description: string;
  pattern: string | null;
  keyword: string | null;
  isActive: boolean;
};

export type DraftFinding = {
  ruleId: string | null;
  category: string;
  source: "DETERMINISTIC" | "AI";
  severity: string;
  title: string;
  description: string;
  recommendation: string | null;
  evidence: Record<string, unknown> | null;
  confidence: number | null;
};

export type ScoreSet = {
  brandIdentity: number | null;
  visualQuality: number | null;
  brandVibe: number | null;
  content: number | null;
  compliance: number | null;
};

export type DeterministicAnalysis = {
  findings: DraftFinding[];
  scores: ScoreSet;
  metadata: {
    limitations: string[];
    palette: ReturnType<typeof analyzePalette>;
    logo: LogoDetection | null;
    visual: VisualAnalysis | null;
    rulesEvaluated: number;
    rulesSkipped: string[];
    fontMatch: { status: "matched" | "mismatch" | "unavailable" | "not-configured"; observed: string[]; approved: string[] };
  };
};

function normalize(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function lower(value: string) {
  return normalize(value).toLowerCase();
}

function normalizeFontName(value: string) {
  return value
    .replace(/^[A-Z]{6}\+/, "")
    .replace(/[-_,](regular|bold|italic|oblique|medium|light|semibold|black).*$/i, "")
    .replace(/mt$/i, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function snippet(text: string, index: number, length: number) {
  const start = Math.max(0, index - 70);
  const end = Math.min(text.length, index + length + 70);

  return `${start > 0 ? "…" : ""}${text
    .slice(start, end)
    .replace(/\s+/g, " ")
    .trim()}${end < text.length ? "…" : ""}`;
}

function severityWeight(severity: string) {
  return SEVERITY_WEIGHTS[severity] ?? 0;
}

function scoringCategoryScore(
  findings: DraftFinding[],
  category: string,
): number {
  const deduction = findings
    .filter((finding) => finding.category === category)
    .reduce(
      (total, finding) => total + severityWeight(finding.severity),
      0,
    );

  return Math.max(0, 100 - deduction);
}

export function computeOverallScore(scores: ScoreSet): number | null {
  const entries: Array<[number | null, number]> = [
    [scores.brandIdentity, 0.3],
    [scores.visualQuality, 0.2],
    [scores.brandVibe, 0.15],
    [scores.content, 0.2],
    [scores.compliance, 0.15],
  ];

  const available = entries.filter(
    (entry): entry is [number, number] => entry[0] !== null,
  );

  if (available.length === 0) {
    return null;
  }

  const weightSum = available.reduce((total, [, weight]) => total + weight, 0);
  const weighted = available.reduce(
    (total, [score, weight]) => total + score * weight,
    0,
  );

  return Math.round(weighted / weightSum);
}

export function analyzeDeterministic({
  extraction,
  rules,
  brandColors,
  brandFonts,
  visual,
  logo,
  approvedLogoCount,
  extractionNotes = [],
}: {
  extraction: { text: string; data: ExtractionData | null };
  rules: RuleInput[];
  brandColors: Array<{ hex: string; name: string | null }>;
  brandFonts: string[];
  visual: VisualAnalysis | null;
  logo: LogoDetection | null;
  approvedLogoCount: number;
  extractionNotes?: string[];
}): DeterministicAnalysis {
  const findings: DraftFinding[] = [];
  const limitations: string[] = [...extractionNotes];
  const rulesSkipped: string[] = [];
  const text = extraction.text ?? "";
  const normalizedText = normalize(text);
  const searchableText = lower(text);
  const hasText = normalizedText.length > 0;
  const activeRules = rules.filter((rule) => rule.isActive);

  for (const rule of activeRules) {
    if (rule.ruleType === "TONE") {
      rulesSkipped.push(`${rule.name} — tone requires AI-assisted review.`);
      continue;
    }

    if (
      rule.ruleType === "VISUAL_COLOR" ||
      rule.ruleType === "VISUAL_TYPOGRAPHY" ||
      rule.ruleType === "OTHER"
    ) {
      rulesSkipped.push(
        `${rule.name} — ${rule.ruleType.toLowerCase().replace(/_/g, " ")} checks are not applied by the deterministic engine.`,
      );
      continue;
    }

    if (rule.ruleType === "VISUAL_LOGO") {
      if (approvedLogoCount === 0) {
        findings.push({
          ruleId: rule.id,
          category: rule.category,
          source: "DETERMINISTIC",
          severity: rule.severity,
          title: "No approved logo asset is configured",
          description: `The rule “${rule.name}” requires an approved logo, but this brand has none marked as approved.`,
          recommendation:
            "Upload a primary logo and mark it approved in the brand workspace.",
          evidence: { rule: rule.name, ruleType: rule.ruleType },
          confidence: 1,
        });
      } else if (logo?.status === "not-detected") {
        findings.push({
          ruleId: rule.id,
          category: rule.category,
          source: "DETERMINISTIC",
          severity: rule.severity,
          title: "Approved logo was not detected",
          description: `Visual similarity search did not find a confident match for an approved logo. Best similarity: ${Math.round(
            logo.bestSimilarity * 100,
          )}%. Automated logo matching can miss logos that are cropped, recolored, or heavily composited.`,
          recommendation:
            "Confirm the logo is present and legible, or review the approved logo assets.",
          evidence: { bestSimilarity: logo.bestSimilarity },
          confidence: 0.6,
        });
      }
      continue;
    }

    if (
      rule.ruleType === "FORBIDDEN_PHRASE" ||
      rule.ruleType === "REQUIRED_PHRASE" ||
      rule.ruleType === "REQUIRED_DISCLAIMER"
    ) {
      if (!hasText) {
        rulesSkipped.push(
          `${rule.name} — no text was extracted, so the check was not applied.`,
        );
        continue;
      }

      if (!rule.keyword) {
        rulesSkipped.push(`${rule.name} — no keyword is configured.`);
        continue;
      }

      const keyword = rule.keyword.trim();
      const index = searchableText.indexOf(lower(keyword));
      const isPresent = index >= 0;

      if (rule.ruleType === "FORBIDDEN_PHRASE" && isPresent) {
        findings.push({
          ruleId: rule.id,
          category: rule.category,
          source: "DETERMINISTIC",
          severity: rule.severity,
          title: `Forbidden phrase found: “${keyword}”`,
          description: rule.description,
          recommendation:
            "Remove or rewrite the phrase before this content is published.",
          evidence: {
            keyword,
            excerpt: snippet(normalizedText, index, keyword.length),
          },
          confidence: 0.95,
        });
      }

      if (
        (rule.ruleType === "REQUIRED_PHRASE" ||
          rule.ruleType === "REQUIRED_DISCLAIMER") &&
        !isPresent
      ) {
        findings.push({
          ruleId: rule.id,
          category: rule.category,
          source: "DETERMINISTIC",
          severity: rule.severity,
          title:
            rule.ruleType === "REQUIRED_DISCLAIMER"
              ? `Required disclaimer is missing: “${keyword}”`
              : `Required phrase is missing: “${keyword}”`,
          description: rule.description,
          recommendation:
            "Add the required language in a legible placement before publishing.",
          evidence: { keyword, textLength: text.length },
          confidence: 0.9,
        });
      }

      continue;
    }

    if (rule.ruleType === "CLAIM_RESTRICTION") {
      if (!hasText) {
        rulesSkipped.push(
          `${rule.name} — no text was extracted, so the check was not applied.`,
        );
        continue;
      }

      if (!rule.pattern) {
        rulesSkipped.push(`${rule.name} — no pattern is configured.`);
        continue;
      }

      try {
        const regex = new RegExp(rule.pattern, "gi");
        const matches = Array.from(text.matchAll(regex))
          .map((match) => match[0])
          .filter(Boolean)
          .slice(0, 5);

        if (matches.length > 0) {
          const index = searchableText.indexOf(lower(matches[0]));

          findings.push({
            ruleId: rule.id,
            category: rule.category,
            source: "DETERMINISTIC",
            severity: rule.severity,
            title: "Restricted claim language found",
            description: rule.description,
            recommendation:
              "Review the claim against compliance guidance and remove or qualify it.",
            evidence: {
              pattern: rule.pattern,
              matches,
              excerpt: snippet(
                normalizedText,
                Math.max(0, index),
                matches[0].length,
              ),
            },
            confidence: 0.95,
          });
        }
      } catch {
        rulesSkipped.push(`${rule.name} — the stored pattern is invalid.`);
      }

      continue;
    }

    if (rule.ruleType === "KEYWORD") {
      if (!rule.keyword) {
        rulesSkipped.push(`${rule.name} — no keyword is configured.`);
        continue;
      }

      if (hasText && searchableText.includes(lower(rule.keyword))) {
        findings.push({
          ruleId: rule.id,
          category: rule.category,
          source: "DETERMINISTIC",
          severity: "INFO",
          title: `Advisory keyword present: “${rule.keyword}”`,
          description: rule.description,
          recommendation:
            "Confirm the keyword is intentional and used in the right context.",
          evidence: { keyword: rule.keyword },
          confidence: 0.9,
        });
      }
    }
  }

  if (hasText && activeRules.length === 0) {
    limitations.push(
      "This brand has no active rules, so no rule-based checks were applied.",
    );
  }

  if (!hasText && extraction.data?.kind === "IMAGE") {
    findings.push({
      ruleId: null,
      category: "CONTENT",
      source: "DETERMINISTIC",
      severity: "INFO",
      title: "No readable text was extracted",
      description:
        "Text-based rules and disclaimer checks could not be evaluated for this image. Visual checks still completed.",
      recommendation:
        "Upload a sharper version or provide a transcript if text compliance matters.",
      evidence: null,
      confidence: 0.9,
    });
  }

  let paletteIssues: ReturnType<typeof analyzePalette> = [];

  if (extraction.data?.dominantColors?.length) {
    if (brandColors.length === 0) {
      limitations.push(
        "No approved color palette is configured, so color alignment was not evaluated.",
      );
    } else {
      paletteIssues = analyzePalette({
        dominantColors: extraction.data.dominantColors,
        brandColors: brandColors.map((color) => color.hex),
      });

      for (const issue of paletteIssues) {
        findings.push({
          ruleId: null,
          category: "BRAND_IDENTITY",
          source: "DETERMINISTIC",
          severity: issue.severity,
          title: `Off-palette color ${issue.hex} covers ${issue.percentage}%`,
          description: `This color is ${issue.nearestDelta} ΔE from the closest approved brand color (${issue.nearestHex}), beyond the alignment threshold.`,
          recommendation:
            "Use an approved palette color or document this color as an intentional extension.",
          evidence: {
            color: issue.hex,
            percentage: issue.percentage,
            nearestApprovedColor: issue.nearestHex,
            deltaE: issue.nearestDelta,
          },
          confidence: 0.85,
        });
      }
    }
  }

  if (visual) {
    for (const issue of visual.issues) {
      findings.push({
        ruleId: null,
        category: "VISUAL_QUALITY",
        source: "DETERMINISTIC",
        severity: issue.severity,
        title: issue.title,
        description: issue.description,
        recommendation: issue.recommendation,
        evidence: issue.evidence ?? null,
        confidence: 0.8,
      });
    }

    if (approvedLogoCount === 0) {
      limitations.push(
        "No approved logo asset is available, so logo presence was not evaluated.",
      );
    } else if (logo?.status === "detected") {
      limitations.push(
        `Approved logo “${logo.logoName}” matched a region at ${Math.round(
          logo.similarity * 100,
        )}% perceptual similarity.`,
      );
    } else if (logo?.status === "not-detected") {
      findings.push({
        ruleId: null,
        category: "VISUAL_QUALITY",
        source: "DETERMINISTIC",
        severity: "MEDIUM",
        title: "Approved logo was not detected",
        description: `Automated similarity search did not find a confident match (best ${Math.round(
          logo.bestSimilarity * 100,
        )}%). Cropped, recolored, or composited logos can be missed.`,
        recommendation:
          "Verify the logo is placed intentionally, or update the approved logo asset.",
        evidence: { bestSimilarity: logo.bestSimilarity },
        confidence: 0.6,
      });
    }
  } else if (
    extraction.data?.kind === "PDF" ||
    extraction.data?.kind === "DOCX"
  ) {
    limitations.push("Image visual-quality and logo checks apply to uploaded images only. PDF/DOCX documents are checked using available text and font metadata.");
  }

  const observedFonts = Array.from(new Set((extraction.data?.fontHints ?? []).filter(Boolean))).slice(0, 16);
  const normalizedApprovedFonts = brandFonts.map(normalizeFontName).filter(Boolean);
  const unmatchedFonts = observedFonts.filter((font) => !normalizedApprovedFonts.includes(normalizeFontName(font)));
  const fontMatch: DeterministicAnalysis["metadata"]["fontMatch"] =
    normalizedApprovedFonts.length === 0
      ? { status: "not-configured", observed: observedFonts, approved: brandFonts }
      : observedFonts.length === 0
        ? { status: "unavailable", observed: observedFonts, approved: brandFonts }
        : { status: unmatchedFonts.length === 0 ? "matched" : "mismatch", observed: observedFonts, approved: brandFonts };

  if (normalizedApprovedFonts.length > 0 && unmatchedFonts.length > 0) {
    findings.push({
      ruleId: null,
      category: "VISUAL_QUALITY",
      source: "DETERMINISTIC",
      severity: "MEDIUM",
      title: "Unapproved font detected",
      description: `Document font metadata includes ${unmatchedFonts.slice(0, 5).join(", ")}, which is not on the approved font list (${brandFonts.join(", ")}).`,
      recommendation: "Use an approved brand font and re-export the document.",
      evidence: { observed: observedFonts, unmatched: unmatchedFonts, approved: brandFonts },
      confidence: 0.85,
    });
  } else if (fontMatch.status === "unavailable") {
    limitations.push("Font metadata was unavailable for this file, so approved-font matching could not be evaluated.");
  }

  const scores: ScoreSet = {
    brandIdentity: scoringCategoryScore(findings, "BRAND_IDENTITY"),
    visualQuality: visual
      ? scoringCategoryScore(findings, "VISUAL_QUALITY")
      : null,
    brandVibe: null,
    content: hasText ? scoringCategoryScore(findings, "CONTENT") : null,
    compliance: hasText
      ? scoringCategoryScore(findings, "COMPLIANCE")
      : null,
  };

  if (findings.length === 0) {
    limitations.push(
      "No deterministic findings were produced. This does not guarantee the content is compliant; it means the configured checks passed.",
    );
  }

  return {
    findings,
    scores,
    metadata: {
      limitations: Array.from(new Set(limitations)),
      palette: paletteIssues,
      logo,
      visual,
      rulesEvaluated: activeRules.length,
      rulesSkipped,
      fontMatch,
    },
  };
}
