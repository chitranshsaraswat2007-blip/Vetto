export type ReviewActionState = {
  error?: string;
  success?: string;
};

export const initialReviewState: ReviewActionState = {};

export const findingStatuses = [
  "OPEN",
  "ACKNOWLEDGED",
  "RESOLVED",
  "DISMISSED",
] as const;
export type FindingStatusValue = (typeof findingStatuses)[number];

export const reviewDecisions = ["APPROVED", "CHANGES_REQUESTED"] as const;
export type ReviewDecisionValue = (typeof reviewDecisions)[number];

export const reviewActionLabels: Record<string, string> = {
  SUBMITTED: "Submitted for review",
  APPROVED: "Approved",
  CHANGES_REQUESTED: "Changes requested",
  COMMENTED: "Comment",
  SUPERVISOR_REVIEWED: "Supervisor secondary review",
};

export const findingStatusLabels: Record<string, string> = {
  OPEN: "Open",
  ACKNOWLEDGED: "Acknowledged",
  RESOLVED: "Resolved",
  DISMISSED: "Dismissed",
};

export const findingStatusVariants: Record<
  string,
  "neutral" | "accent" | "success" | "warning" | "danger" | "info" | "outline"
> = {
  OPEN: "danger",
  ACKNOWLEDGED: "warning",
  RESOLVED: "success",
  DISMISSED: "neutral",
};
