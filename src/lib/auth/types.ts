export type AppRole = "CREATOR" | "SUPERVISOR" | "MANAGER" | "ADMIN";

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  role: AppRole;
};

export type LoginState = {
  error?: string;
};

export type RegistrationField =
  | "fullName"
  | "email"
  | "password"
  | "confirmPassword"
  | "role";

export type RegisterState = {
  error?: string;
  fieldErrors?: Partial<Record<RegistrationField, string>>;
};
