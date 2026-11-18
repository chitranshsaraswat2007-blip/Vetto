export const MAX_CONTENT_BYTES = 20 * 1024 * 1024;

export const CONTENT_KIND_LABELS: Record<string, string> = {
  IMAGE: "Image",
  PDF: "PDF",
  DOCX: "DOCX",
  DOC: "DOC",
};

export const CONTENT_STATUS_LABELS: Record<string, string> = {
  DRAFT: "Draft",
  UPLOADED: "Uploaded",
  PROCESSING: "Extracting",
  ANALYZING: "Analyzing",
  REVIEW_READY: "Review ready",
  SUBMITTED: "Submitted",
  CHANGES_REQUESTED: "Changes requested",
  APPROVED: "Approved",
  FAILED: "Failed",
};

export const CONTENT_STATUS_VARIANTS: Record<
  string,
  "neutral" | "accent" | "success" | "warning" | "danger" | "info" | "outline"
> = {
  DRAFT: "outline",
  UPLOADED: "neutral",
  PROCESSING: "info",
  ANALYZING: "info",
  REVIEW_READY: "accent",
  SUBMITTED: "warning",
  CHANGES_REQUESTED: "warning",
  APPROVED: "success",
  FAILED: "danger",
};

export const SEVERITY_WEIGHTS: Record<string, number> = {
  CRITICAL: 30,
  HIGH: 18,
  MEDIUM: 10,
  LOW: 5,
  INFO: 1,
};
