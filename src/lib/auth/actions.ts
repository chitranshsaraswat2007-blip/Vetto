"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { recordAudit } from "@/lib/audit";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { safeNextPath } from "@/lib/auth/redirect";
import { createSession, destroySession } from "@/lib/auth/session";
import type {
  LoginState,
  RegisterState,
  RegistrationField,
} from "@/lib/auth/types";
import { db } from "@/lib/db";
import {
  consumeRateLimit,
  getRequestAddress,
  rateLimitMessage,
} from "@/lib/security/rate-limit";

const DUMMY_PASSWORD_HASH =
  "$2b$10$yyGRFnvUsabJ9YGzVRmHVugH/cc9HVprSJRPIUPiTTfUiNmpG/gSm";

const normalizedEmail = (value: unknown) =>
  typeof value === "string" ? value.trim().toLowerCase() : value;

const emailSchema = z.preprocess(
  normalizedEmail,
  z.email("Enter a valid email address.").max(254, "Email is too long."),
);

const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(200),
});

const registerSchema = z
  .object({
    fullName: z
      .string()
      .trim()
      .min(2, "Enter your full name.")
      .max(80, "Name must be 80 characters or fewer."),
    email: emailSchema,
    password: z
      .string()
      .min(10, "Use at least 10 characters.")
      .refine(
        (value) => Buffer.byteLength(value, "utf8") <= 72,
        "Password must be 72 bytes or fewer.",
      ),
    confirmPassword: z.string().min(1, "Confirm your password."),
  })
  .refine((values) => values.password === values.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match.",
  });

const registrationFields = new Set<RegistrationField>([
  "fullName",
  "email",
  "password",
  "confirmPassword",
]);

function requestEmailKey(formData: FormData) {
  const email = formData.get("email");
  return typeof email === "string" ? email.trim().toLowerCase().slice(0, 254) : "";
}

export async function loginAction(
  _previousState: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const address = await getRequestAddress();
  const emailKey = requestEmailKey(formData);

  const pairLimit = consumeRateLimit(`login:pair:${address}:${emailKey}`, {
    limit: 8,
    windowMs: 10 * 60 * 1000,
  });
  const addressLimit = consumeRateLimit(`login:address:${address}`, {
    limit: 30,
    windowMs: 10 * 60 * 1000,
  });

  if (!pairLimit.allowed || !addressLimit.allowed) {
    return {
      error: rateLimitMessage(
        Math.max(pairLimit.retryAfterSeconds, addressLimit.retryAfterSeconds),
      ),
    };
  }

  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: "Enter a valid email address and password." };
  }

  const user = await db.user.findUnique({
    where: { email: parsed.data.email },
  });

  const candidateHash = user?.passwordHash ?? DUMMY_PASSWORD_HASH;
  const passwordMatches = await verifyPassword(
    parsed.data.password,
    candidateHash,
  );

  if (
    !user ||
    !user.passwordHash ||
    !passwordMatches ||
    !user.isActive
  ) {
    return { error: "Email or password is incorrect." };
  }

  await createSession(user.id);
  redirect(safeNextPath(formData.get("next")));
}

export async function registerAction(
  _previousState: RegisterState,
  formData: FormData,
): Promise<RegisterState> {
  const address = await getRequestAddress();
  const emailKey = requestEmailKey(formData);

  const addressLimit = consumeRateLimit(`register:address:${address}`, {
    limit: 5,
    windowMs: 60 * 60 * 1000,
  });
  const emailLimit = consumeRateLimit(
    `register:email:${address}:${emailKey}`,
    {
      limit: 3,
      windowMs: 60 * 60 * 1000,
    },
  );

  if (!addressLimit.allowed || !emailLimit.allowed) {
    return {
      error: rateLimitMessage(
        Math.max(
          addressLimit.retryAfterSeconds,
          emailLimit.retryAfterSeconds,
        ),
      ),
    };
  }

  const parsed = registerSchema.safeParse({
    fullName: formData.get("fullName"),
    email: formData.get("email"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });

  if (!parsed.success) {
    const fieldErrors: RegisterState["fieldErrors"] = {};

    for (const issue of parsed.error.issues) {
      const field = issue.path[0];
      if (
        typeof field === "string" &&
        registrationFields.has(field as RegistrationField) &&
        !fieldErrors[field as RegistrationField]
      ) {
        fieldErrors[field as RegistrationField] = issue.message;
      }
    }

    return { fieldErrors };
  }

  const passwordHash = await hashPassword(parsed.data.password);

  let user: { id: string; role: string };

  try {
    user = await db.user.create({
      data: {
        name: parsed.data.fullName,
        email: parsed.data.email,
        passwordHash,
        role: "CREATOR",
      },
      select: { id: true, role: true },
    });
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "P2002"
    ) {
      return {
        fieldErrors: {
          email: "An account with this email already exists.",
        },
      };
    }

    console.error("Registration failed", error);
    return {
      error: "We could not create your account. Please try again.",
    };
  }

  await recordAudit({
    actorId: user.id,
    action: "auth.registered",
    entityType: "User",
    entityId: user.id,
    metadata: { role: user.role },
  });

  await createSession(user.id);
  redirect("/dashboard");
}

export async function logoutAction() {
  await destroySession();
  redirect("/login");
}
