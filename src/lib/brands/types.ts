export type ActionState = {
  error?: string;
  success?: string;
};

export const initialActionState: ActionState = {};

export const brandStatuses = ["DRAFT", "ACTIVE", "ARCHIVED"] as const;
export type BrandStatusValue = (typeof brandStatuses)[number];

export const ruleCategories = [
  "BRAND_IDENTITY",
  "VISUAL_QUALITY",
  "BRAND_VIBE",
  "CONTENT",
  "COMPLIANCE",
] as const;
export type RuleCategoryValue = (typeof ruleCategories)[number];

export const ruleTypes = [
  "FORBIDDEN_PHRASE",
  "REQUIRED_PHRASE",
  "REQUIRED_DISCLAIMER",
  "CLAIM_RESTRICTION",
  "KEYWORD",
  "TONE",
  "VISUAL_COLOR",
  "VISUAL_LOGO",
  "VISUAL_TYPOGRAPHY",
  "OTHER",
] as const;
export type RuleTypeValue = (typeof ruleTypes)[number];

export const severities = [
  "CRITICAL",
  "HIGH",
  "MEDIUM",
  "LOW",
  "INFO",
] as const;
export type SeverityValue = (typeof severities)[number];

export const approvalStatuses = ["PENDING", "APPROVED", "REJECTED"] as const;
export type ApprovalStatusValue = (typeof approvalStatuses)[number];

export const assetKinds = ["LOGO", "IMAGERY", "OTHER"] as const;
export type AssetKindValue = (typeof assetKinds)[number];
