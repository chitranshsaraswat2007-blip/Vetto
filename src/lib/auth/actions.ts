"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { recordAudit } from "@/lib/audit";
import { createAuthLink, hashAuthToken, sendAuthEmail } from "@/lib/auth/email";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { safeNextPath } from "@/lib/auth/redirect";
import { createSession, destroySession } from "@/lib/auth/session";
import type {
  LoginState,
  RegisterState,
  RegistrationField,
} from "@/lib/auth/types";
import { db } from "@/lib/db";
import { signupRoles } from "@/lib/users/types";
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
    role: z.enum(signupRoles),
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
  "role",
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

  if (!user.emailVerifiedAt) {
    return { error: "Verify your email address before signing in. Check your inbox for the verification link." };
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
    role: formData.get("role"),
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

  let user: { id: string; role: string; email: string };

  try {
    user = await db.user.create({
      data: {
        name: parsed.data.fullName,
        email: parsed.data.email,
        passwordHash,
        role: parsed.data.role,
      },
      select: { id: true, role: true, email: true },
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

  const link = await createAuthLink({ userId: user.id, purpose: "VERIFY_EMAIL" });
  try {
    await sendAuthEmail({ to: user.email, link, purpose: "VERIFY_EMAIL" });
  } catch (error) {
    console.error("Verification email could not be delivered", error);
    return {
      message: "Your account was created, but the verification email could not be sent. Ask an administrator to check the email service configuration, then use resend verification.",
      ...(process.env.NODE_ENV !== "production" ? { devLink: link } : {}),
    };
  }
  return {
    message: `Account created. Check ${user.email} for a verification link before signing in.`,
    ...(process.env.NODE_ENV !== "production" ? { devLink: link } : {}),
  };
}

export async function resendVerificationAction(
  _previousState: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const address = await getRequestAddress();
  const email = requestEmailKey(formData);
  const limit = consumeRateLimit(`verify:resend:${address}:${email}`, { limit: 3, windowMs: 60 * 60 * 1000 });
  if (!limit.allowed) return { error: rateLimitMessage(limit.retryAfterSeconds) };
  const parsed = emailSchema.safeParse(formData.get("email"));
  if (!parsed.success) return { error: "Enter the email address for your account." };
  const user = await db.user.findUnique({ where: { email: parsed.data } });
  if (user && !user.emailVerifiedAt && user.isActive) {
    const link = await createAuthLink({ userId: user.id, purpose: "VERIFY_EMAIL" });
    try {
      await sendAuthEmail({ to: user.email, link, purpose: "VERIFY_EMAIL" });
      return {
        message: "If that account needs verification, a new link has been sent.",
        ...(process.env.NODE_ENV !== "production" ? { devLink: link } : {}),
      };
    } catch (error) {
      console.error("Verification email could not be delivered", error);
      return process.env.NODE_ENV === "production"
        ? { message: "If that account needs verification, a new link has been sent." }
        : { message: "Email delivery is not configured in development.", devLink: link };
    }
  }
  return { message: "If that account needs verification, a new link has been sent." };
}

export async function requestPasswordResetAction(
  _previousState: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const address = await getRequestAddress();
  const email = requestEmailKey(formData);
  const limit = consumeRateLimit(`password-reset:${address}:${email}`, { limit: 4, windowMs: 60 * 60 * 1000 });
  if (!limit.allowed) return { message: "If an active account matches, a reset link has been sent." };
  const parsed = emailSchema.safeParse(formData.get("email"));
  let devLink: string | undefined;
  if (parsed.success) {
    const user = await db.user.findUnique({ where: { email: parsed.data } });
    if (user?.passwordHash && user.isActive) {
      const link = await createAuthLink({ userId: user.id, purpose: "RESET_PASSWORD" });
      if (process.env.NODE_ENV !== "production") devLink = link;
      try {
        await sendAuthEmail({ to: user.email, link, purpose: "RESET_PASSWORD" });
      } catch (error) {
        console.error("Password reset email could not be delivered", error);
      }
    }
  }
  return { message: "If an active account matches, a reset link has been sent.", ...(devLink ? { devLink } : {}) };
}

export async function verifyEmailAction(formData: FormData) {
  const token = formData.get("token");
  if (typeof token !== "string" || token.length > 200) redirect("/verify-email?result=invalid");
  const record = await db.authToken.findUnique({ where: { tokenHash: hashAuthToken(token) } });
  if (!record || record.purpose !== "VERIFY_EMAIL" || record.usedAt || record.expiresAt <= new Date()) {
    redirect("/verify-email?result=invalid");
  }
  const now = new Date();
  const claimed = await db.$transaction(async (tx) => {
    const result = await tx.authToken.updateMany({
      where: { id: record.id, usedAt: null, expiresAt: { gt: now } },
      data: { usedAt: now },
    });
    if (result.count !== 1) return false;
    await tx.user.update({ where: { id: record.userId }, data: { emailVerifiedAt: now } });
    return true;
  });
  if (!claimed) redirect("/verify-email?result=invalid");
  redirect("/verify-email?result=success");
}

export async function resetPasswordAction(formData: FormData) {
  const token = formData.get("token");
  const password = formData.get("password");
  const confirmation = formData.get("confirmPassword");
  if (typeof token !== "string" || token.length > 200) redirect("/reset-password?result=invalid");
  const parsed = z.object({
    password: z.string().min(10).refine((value) => Buffer.byteLength(value, "utf8") <= 72),
    confirmPassword: z.string().min(1),
  }).refine((value) => value.password === value.confirmPassword).safeParse({ password, confirmPassword: confirmation });
  if (!parsed.success) redirect(`/reset-password?token=${encodeURIComponent(token)}&result=invalid-input`);
  const record = await db.authToken.findUnique({ where: { tokenHash: hashAuthToken(token) } });
  if (!record || record.purpose !== "RESET_PASSWORD" || record.usedAt || record.expiresAt <= new Date()) {
    redirect("/reset-password?result=invalid");
  }
  const passwordHash = await hashPassword(parsed.data.password);
  const now = new Date();
  const changed = await db.$transaction(async (tx) => {
    const claimed = await tx.authToken.updateMany({
      where: { id: record.id, usedAt: null, expiresAt: { gt: now } },
      data: { usedAt: now },
    });
    if (claimed.count !== 1) return false;
    await tx.user.update({ where: { id: record.userId }, data: { passwordHash } });
    await tx.session.deleteMany({ where: { userId: record.userId } });
    return true;
  });
  if (!changed) redirect("/reset-password?result=invalid");
  redirect("/login?passwordReset=1");
}

export async function logoutAction() {
  await destroySession();
  redirect("/login");
}
