"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { recordAudit } from "@/lib/audit";
import { requirePermission } from "@/lib/auth/guards";
import {
  approvalStatuses,
  brandStatuses,
  ruleCategories,
  ruleTypes,
  severities,
  type ActionState,
} from "@/lib/brands/types";
import { db } from "@/lib/db";
import { getStorageAdapter } from "@/lib/storage";

function getString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function getOptionalString(formData: FormData, key: string) {
  const value = getString(formData, key);
  return value === "" ? undefined : value;
}

function slugify(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

function parsePersonality(value: string) {
  return Array.from(
    new Set(
      value
        .split(/[,\n]/)
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  ).slice(0, 12);
}

function revalidateBrand(brandId: string) {
  revalidatePath("/brands");
  revalidatePath(`/brands/${brandId}`);
}

const brandSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Brand name must be at least 2 characters.")
    .max(80, "Brand name must be 80 characters or fewer."),
  slug: z.string().trim().max(60).optional(),
  status: z.enum(brandStatuses),
  description: z
    .string()
    .trim()
    .max(600, "Description must be 600 characters or fewer.")
    .optional(),
});

const profileSchema = z.object({
  description: z.string().trim().max(1200).optional(),
  personality: z.string().trim().max(500).optional(),
  tone: z.string().trim().max(400).optional(),
  visualStyle: z.string().trim().max(600).optional(),
  imageryStyle: z.string().trim().max(600).optional(),
  designDirection: z.string().trim().max(600).optional(),
});

function firstIssue(error: z.ZodError): ActionState {
  return { error: error.issues[0]?.message ?? "Check the submitted values." };
}

export async function createBrandAction(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requirePermission("brand:manage");

  const parsed = brandSchema.safeParse({
    name: getString(formData, "name"),
    slug: getOptionalString(formData, "slug"),
    status: getString(formData, "status") || "DRAFT",
    description: getOptionalString(formData, "description"),
  });

  if (!parsed.success) {
    return firstIssue(parsed.error);
  }

  const profileParsed = profileSchema.safeParse({
    description: getOptionalString(formData, "profileDescription"),
    personality: getOptionalString(formData, "personality"),
    tone: getOptionalString(formData, "tone"),
    visualStyle: getOptionalString(formData, "visualStyle"),
    imageryStyle: getOptionalString(formData, "imageryStyle"),
    designDirection: getOptionalString(formData, "designDirection"),
  });

  if (!profileParsed.success) {
    return firstIssue(profileParsed.error);
  }

  const slug = slugify(parsed.data.slug || parsed.data.name);

  if (!slug) {
    return { error: "Enter a valid slug using letters, numbers, and dashes." };
  }

  const existing = await db.brand.findUnique({ where: { slug } });

  if (existing) {
    return { error: "That slug is already in use by another brand." };
  }

  const profile = profileParsed.data;
  const hasProfile = Boolean(
    profile.description ||
      profile.tone ||
      profile.visualStyle ||
      profile.imageryStyle ||
      profile.designDirection ||
      profile.personality,
  );

  let brandId: string;

  try {
    const brand = await db.brand.create({
      data: {
        name: parsed.data.name,
        slug,
        description: parsed.data.description,
        status: parsed.data.status,
        createdById: user.id,
        profile: hasProfile
          ? {
              create: {
                description: profile.description,
                personality: parsePersonality(profile.personality ?? ""),
                tone: profile.tone,
                visualStyle: profile.visualStyle,
                imageryStyle: profile.imageryStyle,
                designDirection: profile.designDirection,
              },
            }
          : undefined,
      },
    });

    brandId = brand.id;
  } catch (error) {
    console.error("Brand creation failed", error);
    return { error: "The brand could not be created. Try again." };
  }

  await recordAudit({
    actorId: user.id,
    action: "brand.created",
    entityType: "Brand",
    entityId: brandId,
    brandId,
    metadata: { name: parsed.data.name, slug },
  });

  revalidateBrand(brandId);
  redirect(`/brands/${brandId}`);
}

export async function updateBrandAction(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requirePermission("brand:manage");
  const brandId = getString(formData, "brandId");

  if (!brandId) {
    return { error: "Brand could not be identified." };
  }

  const parsed = brandSchema.safeParse({
    name: getString(formData, "name"),
    slug: getString(formData, "slug"),
    status: getString(formData, "status") || "DRAFT",
    description: getOptionalString(formData, "description"),
  });

  if (!parsed.success) {
    return firstIssue(parsed.error);
  }

  const slug = slugify(parsed.data.slug || parsed.data.name);

  if (!slug) {
    return { error: "Enter a valid slug using letters, numbers, and dashes." };
  }

  const brand = await db.brand.findUnique({ where: { id: brandId } });

  if (!brand) {
    return { error: "Brand no longer exists." };
  }

  const conflicting = await db.brand.findFirst({
    where: { slug, id: { not: brandId } },
    select: { id: true },
  });

  if (conflicting) {
    return { error: "That slug is already in use by another brand." };
  }

  await db.brand.update({
    where: { id: brandId },
    data: {
      name: parsed.data.name,
      slug,
      description: parsed.data.description,
      status: parsed.data.status,
    },
  });

  await recordAudit({
    actorId: user.id,
    action: "brand.updated",
    entityType: "Brand",
    entityId: brandId,
    brandId,
    metadata: { name: parsed.data.name, slug, status: parsed.data.status },
  });

  revalidateBrand(brandId);
  return { success: "Brand details saved." };
}

export async function updateBrandProfileAction(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requirePermission("brand:manage");
  const brandId = getString(formData, "brandId");

  if (!brandId) {
    return { error: "Brand could not be identified." };
  }

  const parsed = profileSchema.safeParse({
    description: getOptionalString(formData, "description"),
    personality: getOptionalString(formData, "personality"),
    tone: getOptionalString(formData, "tone"),
    visualStyle: getOptionalString(formData, "visualStyle"),
    imageryStyle: getOptionalString(formData, "imageryStyle"),
    designDirection: getOptionalString(formData, "designDirection"),
  });

  if (!parsed.success) {
    return firstIssue(parsed.error);
  }

  const data = {
    description: parsed.data.description,
    personality: parsePersonality(parsed.data.personality ?? ""),
    tone: parsed.data.tone,
    visualStyle: parsed.data.visualStyle,
    imageryStyle: parsed.data.imageryStyle,
    designDirection: parsed.data.designDirection,
  };

  await db.brandProfile.upsert({
    where: { brandId },
    update: data,
    create: { brandId, ...data },
  });

  await recordAudit({
    actorId: user.id,
    action: "brand.profile_updated",
    entityType: "Brand",
    entityId: brandId,
    brandId,
  });

  revalidateBrand(brandId);
  return { success: "Brand intelligence saved." };
}

const colorSchema = z.object({
  hex: z
    .string()
    .trim()
    .regex(/^#[0-9a-fA-F]{6}$/, "Enter a six-digit hex color, e.g. #C98A5B.")
    .transform((value) => value.toUpperCase()),
  name: z.string().trim().max(60).optional(),
  usage: z.string().trim().max(120).optional(),
  isPrimary: z.boolean(),
});

export async function addColorAction(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requirePermission("brand:manage");
  const brandId = getString(formData, "brandId");

  if (!brandId) {
    return { error: "Brand could not be identified." };
  }

  const parsed = colorSchema.safeParse({
    hex: getString(formData, "hex"),
    name: getOptionalString(formData, "name"),
    usage: getOptionalString(formData, "usage"),
    isPrimary: formData.get("isPrimary") === "on",
  });

  if (!parsed.success) {
    return firstIssue(parsed.error);
  }

  const colorCount = await db.brandColor.count({ where: { brandId } });

  if (colorCount >= 12) {
    return { error: "A brand can hold up to 12 colors." };
  }

  const operations = [];

  if (parsed.data.isPrimary) {
    operations.push(
      db.brandColor.updateMany({
        where: { brandId },
        data: { isPrimary: false },
      }),
    );
  }

  operations.push(
    db.brandColor.create({
      data: {
        brandId,
        hex: parsed.data.hex,
        name: parsed.data.name,
        usage: parsed.data.usage,
        isPrimary: parsed.data.isPrimary,
      },
    }),
  );

  await db.$transaction(operations);

  await recordAudit({
    actorId: user.id,
    action: "brand.color_added",
    entityType: "BrandColor",
    brandId,
    metadata: { hex: parsed.data.hex, name: parsed.data.name },
  });

  revalidateBrand(brandId);
  return { success: "Color added." };
}

export async function deleteColorAction(formData: FormData) {
  const user = await requirePermission("brand:manage");
  const brandId = getString(formData, "brandId");
  const colorId = getString(formData, "colorId");

  if (!brandId || !colorId) {
    return;
  }

  const result = await db.brandColor.deleteMany({
    where: { id: colorId, brandId },
  });

  if (result.count > 0) {
    await recordAudit({
      actorId: user.id,
      action: "brand.color_removed",
      entityType: "BrandColor",
      entityId: colorId,
      brandId,
    });
  }

  revalidateBrand(brandId);
}

const fontSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Font name is required.")
    .max(80, "Font name must be 80 characters or fewer."),
  usage: z.string().trim().max(120).optional(),
  isApproved: z.boolean(),
});

export async function addFontAction(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requirePermission("brand:manage");
  const brandId = getString(formData, "brandId");

  if (!brandId) {
    return { error: "Brand could not be identified." };
  }

  const parsed = fontSchema.safeParse({
    name: getString(formData, "name"),
    usage: getOptionalString(formData, "usage"),
    isApproved: formData.get("isApproved") === "on",
  });

  if (!parsed.success) {
    return firstIssue(parsed.error);
  }

  const fontCount = await db.brandFont.count({ where: { brandId } });

  if (fontCount >= 12) {
    return { error: "A brand can hold up to 12 fonts." };
  }

  await db.brandFont.create({
    data: {
      brandId,
      name: parsed.data.name,
      usage: parsed.data.usage,
      isApproved: parsed.data.isApproved,
    },
  });

  await recordAudit({
    actorId: user.id,
    action: "brand.font_added",
    entityType: "BrandFont",
    brandId,
    metadata: { name: parsed.data.name },
  });

  revalidateBrand(brandId);
  return { success: "Font added." };
}

export async function deleteFontAction(formData: FormData) {
  const user = await requirePermission("brand:manage");
  const brandId = getString(formData, "brandId");
  const fontId = getString(formData, "fontId");

  if (!brandId || !fontId) {
    return;
  }

  const result = await db.brandFont.deleteMany({
    where: { id: fontId, brandId },
  });

  if (result.count > 0) {
    await recordAudit({
      actorId: user.id,
      action: "brand.font_removed",
      entityType: "BrandFont",
      entityId: fontId,
      brandId,
    });
  }

  revalidateBrand(brandId);
}

const ruleSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Rule name must be at least 2 characters.")
    .max(100, "Rule name must be 100 characters or fewer."),
  category: z.enum(ruleCategories),
  ruleType: z.enum(ruleTypes),
  severity: z.enum(severities),
  description: z
    .string()
    .trim()
    .min(3, "Describe what this rule enforces.")
    .max(1000, "Description must be 1000 characters or fewer."),
  pattern: z.string().trim().max(500).optional(),
  keyword: z.string().trim().max(200).optional(),
  isActive: z.boolean(),
});

export async function addRuleAction(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requirePermission("brand:manage");
  const brandId = getString(formData, "brandId");

  if (!brandId) {
    return { error: "Brand could not be identified." };
  }

  const parsed = ruleSchema.safeParse({
    name: getString(formData, "name"),
    category: getString(formData, "category"),
    ruleType: getString(formData, "ruleType"),
    severity: getString(formData, "severity"),
    description: getString(formData, "description"),
    pattern: getOptionalString(formData, "pattern"),
    keyword: getOptionalString(formData, "keyword"),
    isActive: formData.get("isActive") === "on",
  });

  if (!parsed.success) {
    return firstIssue(parsed.error);
  }

  const data = parsed.data;

  if (
    ["FORBIDDEN_PHRASE", "REQUIRED_PHRASE", "REQUIRED_DISCLAIMER"].includes(
      data.ruleType,
    ) &&
    !data.keyword
  ) {
    return { error: "This rule type requires a keyword or phrase." };
  }

  if (data.ruleType === "CLAIM_RESTRICTION" && !data.pattern) {
    return { error: "Claim restrictions require a regular expression." };
  }

  if (data.pattern) {
    try {
      new RegExp(data.pattern);
    } catch {
      return { error: "The pattern is not a valid regular expression." };
    }
  }

  await db.brandRule.create({
    data: {
      brandId,
      name: data.name,
      category: data.category,
      ruleType: data.ruleType,
      severity: data.severity,
      description: data.description,
      pattern: data.pattern,
      keyword: data.keyword,
      isActive: data.isActive,
    },
  });

  await recordAudit({
    actorId: user.id,
    action: "brand.rule_added",
    entityType: "BrandRule",
    brandId,
    metadata: { name: data.name, ruleType: data.ruleType },
  });

  revalidateBrand(brandId);
  return { success: "Rule added." };
}

export async function toggleRuleAction(formData: FormData) {
  const user = await requirePermission("brand:manage");
  const brandId = getString(formData, "brandId");
  const ruleId = getString(formData, "ruleId");
  const isActive = formData.get("isActive") === "true";

  if (!brandId || !ruleId) {
    return;
  }

  const result = await db.brandRule.updateMany({
    where: { id: ruleId, brandId },
    data: { isActive },
  });

  if (result.count > 0) {
    await recordAudit({
      actorId: user.id,
      action: isActive ? "brand.rule_enabled" : "brand.rule_disabled",
      entityType: "BrandRule",
      entityId: ruleId,
      brandId,
    });
  }

  revalidateBrand(brandId);
}

export async function deleteRuleAction(formData: FormData) {
  const user = await requirePermission("brand:manage");
  const brandId = getString(formData, "brandId");
  const ruleId = getString(formData, "ruleId");

  if (!brandId || !ruleId) {
    return;
  }

  const rule = await db.brandRule.findFirst({
    where: { id: ruleId, brandId },
    select: { name: true, ruleType: true },
  });

  const result = await db.brandRule.deleteMany({
    where: { id: ruleId, brandId },
  });

  if (result.count > 0) {
    await recordAudit({
      actorId: user.id,
      action: "brand.rule_deleted",
      entityType: "BrandRule",
      entityId: ruleId,
      brandId,
      metadata: { name: rule?.name, ruleType: rule?.ruleType },
    });
  }

  revalidateBrand(brandId);
}

const assetApprovalSchema = z.object({
  assetId: z.string().min(1),
  brandId: z.string().min(1),
  approvalStatus: z.enum(approvalStatuses),
});

export async function setAssetApprovalAction(formData: FormData) {
  const user = await requirePermission("brand:manage");
  const parsed = assetApprovalSchema.safeParse({
    assetId: getString(formData, "assetId"),
    brandId: getString(formData, "brandId"),
    approvalStatus: getString(formData, "approvalStatus"),
  });

  if (!parsed.success) {
    return;
  }

  const { assetId, brandId, approvalStatus } = parsed.data;

  const previous = await db.brandAsset.findFirst({
    where: { id: assetId, brandId },
    select: { approvalStatus: true },
  });

  await db.brandAsset.updateMany({
    where: { id: assetId, brandId },
    data: { approvalStatus },
  });

  await recordAudit({
    actorId: user.id,
    action: "brand.asset_approval_updated",
    entityType: "BrandAsset",
    entityId: assetId,
    brandId,
    metadata: { previousStatus: previous?.approvalStatus, approvalStatus },
  });

  revalidateBrand(brandId);
}

export async function deleteAssetAction(formData: FormData) {
  const user = await requirePermission("brand:manage");
  const brandId = getString(formData, "brandId");
  const assetId = getString(formData, "assetId");

  if (!brandId || !assetId) {
    return;
  }

  const asset = await db.brandAsset.findFirst({
    where: { id: assetId, brandId },
  });

  if (!asset) {
    return;
  }

  await db.brandAsset.delete({ where: { id: asset.id } }).catch((error) => {
    console.error("Failed to delete brand asset record", error);
  });

  try {
    await getStorageAdapter().deleteObject(asset.storageKey);
  } catch (error) {
    console.error("Failed to delete stored brand asset", error);
  }

  await recordAudit({
    actorId: user.id,
    action: "brand.asset_deleted",
    entityType: "BrandAsset",
    entityId: assetId,
    brandId,
    metadata: { name: asset.name, kind: asset.kind },
  });

  revalidateBrand(brandId);
}
