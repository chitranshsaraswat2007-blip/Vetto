export const brandStatusLabels: Record<string, string> = {
  DRAFT: "Draft",
  ACTIVE: "Active",
  ARCHIVED: "Archived",
};

export const ruleCategoryLabels: Record<string, string> = {
  BRAND_IDENTITY: "Brand identity",
  VISUAL_QUALITY: "Visual quality",
  BRAND_VIBE: "Brand vibe",
  CONTENT: "Content",
  COMPLIANCE: "Compliance",
};

export const ruleTypeLabels: Record<string, string> = {
  FORBIDDEN_PHRASE: "Forbidden phrase",
  REQUIRED_PHRASE: "Required phrase",
  REQUIRED_DISCLAIMER: "Required disclaimer",
  CLAIM_RESTRICTION: "Claim restriction",
  KEYWORD: "Keyword",
  TONE: "Tone",
  VISUAL_COLOR: "Visual color",
  VISUAL_LOGO: "Visual logo",
  VISUAL_TYPOGRAPHY: "Visual typography",
  OTHER: "Other",
};

export const severityLabels: Record<string, string> = {
  CRITICAL: "Critical",
  HIGH: "High",
  MEDIUM: "Medium",
  LOW: "Low",
  INFO: "Info",
};

// Documented decision buckets. The stored severity value is never changed;
// this mapping only groups severities into the language reviewers act on.
export const severityDecisionBuckets: Record<
  string,
  "Block" | "Warn" | "Suggest"
> = {
  CRITICAL: "Block",
  HIGH: "Block",
  MEDIUM: "Warn",
  LOW: "Suggest",
  INFO: "Suggest",
};

export const severityDecisionDescriptions: Record<string, string> = {
  Block: "Must be resolved or waived before publishing.",
  Warn: "Should be addressed, but does not block on its own.",
  Suggest: "Advisory only; use judgement.",
};

export function severityDecisionLabel(severity: string) {
  const bucket = severityDecisionBuckets[severity] ?? "Suggest";
  return `${bucket} · ${severityLabels[severity] ?? severity}`;
}

export const approvalStatusLabels: Record<string, string> = {
  PENDING: "Pending",
  APPROVED: "Approved",
  REJECTED: "Rejected",
};

export const assetKindLabels: Record<string, string> = {
  LOGO: "Logo",
  IMAGERY: "Imagery",
  OTHER: "Other",
};
