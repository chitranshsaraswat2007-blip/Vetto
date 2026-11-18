"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { recordAudit } from "@/lib/audit";
import { requirePermission } from "@/lib/auth/guards";
import { hashPassword } from "@/lib/auth/password";
import { db } from "@/lib/db";
import {
  appRoles,
  type UserActionState,
} from "@/lib/users/types";

const normalizedEmail = (value: unknown) =>
  typeof value === "string" ? value.trim().toLowerCase() : value;

function getString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

const createUserSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Enter the member's full name.")
    .max(80, "Name must be 80 characters or fewer."),
  email: z.preprocess(
    normalizedEmail,
    z.email("Enter a valid email address.").max(254, "Email is too long."),
  ),
  password: z
    .string()
    .min(10, "Use at least 10 characters.")
    .refine(
      (value) => Buffer.byteLength(value, "utf8") <= 72,
      "Password must be 72 bytes or fewer.",
    ),
  role: z.enum(appRoles),
});

const roleUpdateSchema = z.object({
  userId: z.string().min(1),
  role: z.enum(appRoles),
});

const activationSchema = z.object({
  userId: z.string().min(1),
  isActive: z.enum(["true", "false"]),
});

export async function createUserAction(
  _previousState: UserActionState,
  formData: FormData,
): Promise<UserActionState> {
  const actor = await requirePermission("users:manage");

  const parsed = createUserSchema.safeParse({
    name: getString(formData, "name"),
    email: formData.get("email"),
    password: formData.get("password"),
    role: getString(formData, "role"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the submitted values." };
  }

  const passwordHash = await hashPassword(parsed.data.password);

  let createdId: string;

  try {
    const user = await db.user.create({
      data: {
        name: parsed.data.name,
        email: parsed.data.email,
        passwordHash,
        role: parsed.data.role,
      },
      select: { id: true },
    });

    createdId = user.id;
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "P2002"
    ) {
      return { error: "An account with this email already exists." };
    }

    console.error("User creation failed", error);
    return { error: "The member could not be created. Try again." };
  }

  await recordAudit({
    actorId: actor.id,
    action: "user.created",
    entityType: "User",
    entityId: createdId,
    metadata: { email: parsed.data.email, role: parsed.data.role },
  });

  revalidatePath("/users");
  revalidatePath("/dashboard/admin");

  return {
    success: `${parsed.data.name} was added as ${parsed.data.role.toLowerCase()}.`,
  };
}

export async function updateUserRoleAction(formData: FormData) {
  const actor = await requirePermission("users:manage");

  const parsed = roleUpdateSchema.safeParse({
    userId: getString(formData, "userId"),
    role: getString(formData, "role"),
  });

  if (!parsed.success) {
    return;
  }

  if (parsed.data.userId === actor.id && parsed.data.role !== "ADMIN") {
    return;
  }

  const previous = await db.user.findUnique({
    where: { id: parsed.data.userId },
    select: { id: true, role: true },
  });

  if (!previous || previous.role === parsed.data.role) {
    return;
  }

  await db.user.update({
    where: { id: previous.id },
    data: { role: parsed.data.role },
  });

  await recordAudit({
    actorId: actor.id,
    action: "user.role_updated",
    entityType: "User",
    entityId: previous.id,
    metadata: { previousRole: previous.role, role: parsed.data.role },
  });

  revalidatePath("/users");
  revalidatePath("/dashboard/admin");
}

export async function toggleUserActiveAction(formData: FormData) {
  const actor = await requirePermission("users:manage");

  const parsed = activationSchema.safeParse({
    userId: getString(formData, "userId"),
    isActive: getString(formData, "isActive"),
  });

  if (!parsed.success) {
    return;
  }

  const isActive = parsed.data.isActive === "true";

  if (parsed.data.userId === actor.id && !isActive) {
    return;
  }

  const previous = await db.user.findUnique({
    where: { id: parsed.data.userId },
    select: { id: true, isActive: true },
  });

  if (!previous || previous.isActive === isActive) {
    return;
  }

  await db.user.update({
    where: { id: previous.id },
    data: { isActive },
  });

  await recordAudit({
    actorId: actor.id,
    action: isActive ? "user.activated" : "user.deactivated",
    entityType: "User",
    entityId: previous.id,
    metadata: { isActive },
  });

  revalidatePath("/users");
  revalidatePath("/dashboard/admin");
}
