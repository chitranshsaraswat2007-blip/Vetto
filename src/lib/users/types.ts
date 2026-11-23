export type UserActionState = {
  error?: string;
  success?: string;
};

export const initialUserActionState: UserActionState = {};

export const appRoles = ["CREATOR", "SUPERVISOR", "MANAGER", "ADMIN"] as const;
export type AppRoleValue = (typeof appRoles)[number];

// Public registration must not let a visitor grant themselves workspace-wide
// permissions. Admins can assign elevated roles from user management.
export const signupRoles = ["CREATOR"] as const;
