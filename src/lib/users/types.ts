export type UserActionState = {
  error?: string;
  success?: string;
};

export const initialUserActionState: UserActionState = {};

export const appRoles = ["CREATOR", "SUPERVISOR", "MANAGER", "ADMIN"] as const;
export type AppRoleValue = (typeof appRoles)[number];
