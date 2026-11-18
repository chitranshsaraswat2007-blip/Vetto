import type { AppRole } from "@/lib/auth/types";

export type Permission =
  | "content:create"
  | "content:view-all"
  | "content:submit"
  | "content:review"
  | "review:assign"
  | "content:analyze"
  | "brand:manage"
  | "finding:update"
  | "settings:manage"
  | "users:manage";

const rolePermissions: Record<AppRole, Permission[]> = {
  CREATOR: ["content:create", "content:submit", "content:analyze"],
  SUPERVISOR: ["finding:update"],
  MANAGER: [
    "content:view-all",
    "content:review",
    "review:assign",
    "finding:update",
  ],
  ADMIN: [
    "content:create",
    "content:view-all",
    "content:submit",
    "content:review",
    "content:analyze",
    "brand:manage",
    "finding:update",
    "settings:manage",
    "users:manage",
  ],
};

export const roleLabels: Record<AppRole, string> = {
  CREATOR: "Creator",
  SUPERVISOR: "Supervisor",
  MANAGER: "Manager",
  ADMIN: "Admin",
};

export const roleDescriptions: Record<AppRole, string> = {
  CREATOR: "Uploads content, inspects findings, and submits for review.",
  SUPERVISOR: "Reviews manager-approved content assigned to them and triages its findings.",
  MANAGER: "Approves content or requests changes after review.",
  ADMIN: "Manages users, brands, assets, rules, and settings.",
};

export function hasPermission(
  role: AppRole,
  permission: Permission,
): boolean {
  return rolePermissions[role].includes(permission);
}
