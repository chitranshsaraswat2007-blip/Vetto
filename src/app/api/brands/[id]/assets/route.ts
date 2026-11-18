import { NextResponse } from "next/server";

import { recordAudit } from "@/lib/audit";
import { hasPermission } from "@/lib/auth/permissions";
import { getCurrentUser } from "@/lib/auth/session";
import { assetKinds } from "@/lib/brands/types";
import { db } from "@/lib/db";
import { buildStorageKey, getStorageAdapter } from "@/lib/storage";

const MAX_ASSET_BYTES = 10 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
]);

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (!hasPermission(user.role, "brand:manage")) {
    return NextResponse.json(
      { error: "You do not have permission to manage brand assets." },
      { status: 403 },
    );
  }

  const { id: brandId } = await params;
  const brand = await db.brand.findUnique({ where: { id: brandId } });

  if (!brand) {
    return NextResponse.json({ error: "Brand not found." }, { status: 404 });
  }

  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json(
      { error: "Choose an image file to upload." },
      { status: 400 },
    );
  }

  if (file.size > MAX_ASSET_BYTES) {
    return NextResponse.json(
      { error: "Asset files must be 10 MB or smaller." },
      { status: 413 },
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  if (buffer.byteLength > MAX_ASSET_BYTES) {
    return NextResponse.json(
      { error: "Asset files must be 10 MB or smaller." },
      { status: 413 },
    );
  }

  const { fileTypeFromBuffer } = await import("file-type");
  const detected = await fileTypeFromBuffer(buffer);

  if (!detected || !ALLOWED_IMAGE_TYPES.has(detected.mime)) {
    return NextResponse.json(
      { error: "Brand assets must be PNG, JPEG, or WebP images." },
      { status: 415 },
    );
  }

  const kindValue = formData.get("kind");
  const kind =
    typeof kindValue === "string" &&
    assetKinds.includes(kindValue as (typeof assetKinds)[number])
      ? (kindValue as (typeof assetKinds)[number])
      : "OTHER";

  const rawName =
    typeof formData.get("name") === "string"
      ? String(formData.get("name")).trim()
      : "";
  const rawVariant =
    typeof formData.get("variant") === "string"
      ? String(formData.get("variant")).trim()
      : "";
  const rawBackground =
    typeof formData.get("backgroundContext") === "string"
      ? String(formData.get("backgroundContext")).trim()
      : "";

  const name = (rawName || file.name || "Untitled asset").slice(0, 120);
  const adapter = getStorageAdapter();
  const key = buildStorageKey("brand-assets", brandId, file.name || "asset");

  await adapter.putObject({
    key,
    body: buffer,
    contentType: detected.mime,
  });

  try {
    const asset = await db.brandAsset.create({
      data: {
        brandId,
        kind,
        name,
        storageKey: key,
        storageProvider: adapter.provider,
        mimeType: detected.mime,
        variant: rawVariant || null,
        backgroundContext: rawBackground || null,
        uploadedById: user.id,
      },
    });

    await recordAudit({
      actorId: user.id,
      action: "brand.asset_uploaded",
      entityType: "BrandAsset",
      entityId: asset.id,
      brandId,
      metadata: { name, kind, mimeType: detected.mime },
    });

    return NextResponse.json({
      asset: { id: asset.id, name: asset.name, kind: asset.kind },
    });
  } catch (error) {
    console.error("Brand asset record failed", error);
    await adapter.deleteObject(key).catch(() => {});
    return NextResponse.json(
      { error: "The asset could not be saved. Try again." },
      { status: 500 },
    );
  }
}
