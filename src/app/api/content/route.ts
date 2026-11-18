import { NextResponse } from "next/server";

import { recordAudit } from "@/lib/audit";
import { hasPermission } from "@/lib/auth/permissions";
import { getCurrentUser } from "@/lib/auth/session";
import {
  CONTENT_KIND_LABELS,
  MAX_CONTENT_BYTES,
} from "@/lib/content/constants";
import { db } from "@/lib/db";
import { buildStorageKey, getStorageAdapter } from "@/lib/storage";

const IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);
const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const MAX_MULTIPART_OVERHEAD_BYTES = 512 * 1024;

export async function POST(request: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json(
      { error: "Authentication required." },
      { status: 401 },
    );
  }

  if (!hasPermission(user.role, "content:create")) {
    return NextResponse.json(
      { error: "You do not have permission to upload content." },
      { status: 403 },
    );
  }

  const contentLength = request.headers.get("content-length");
  if (
    contentLength &&
    Number.isFinite(Number(contentLength)) &&
    Number(contentLength) > MAX_CONTENT_BYTES + MAX_MULTIPART_OVERHEAD_BYTES
  ) {
    return NextResponse.json(
      { error: "Content files must be 20 MB or smaller." },
      { status: 413 },
    );
  }

  const formData = await request.formData();
  const brandIdValue = formData.get("brandId");
  const brandId = typeof brandIdValue === "string" ? brandIdValue : "";
  const file = formData.get("file");

  if (!brandId) {
    return NextResponse.json(
      { error: "Select a brand for this content." },
      { status: 400 },
    );
  }

  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json(
      { error: "Choose a file to upload." },
      { status: 400 },
    );
  }

  if (file.size > MAX_CONTENT_BYTES) {
    return NextResponse.json(
      { error: "Content files must be 20 MB or smaller." },
      { status: 413 },
    );
  }

  const brand = await db.brand.findUnique({ where: { id: brandId } });

  if (!brand) {
    return NextResponse.json({ error: "Brand not found." }, { status: 404 });
  }

  if (brand.status === "ARCHIVED") {
    return NextResponse.json(
      { error: "This brand is archived. Select an active brand instead." },
      { status: 400 },
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  if (buffer.byteLength > MAX_CONTENT_BYTES) {
    return NextResponse.json(
      { error: "Content files must be 20 MB or smaller." },
      { status: 413 },
    );
  }

  const { fileTypeFromBuffer } = await import("file-type");
  const detected = await fileTypeFromBuffer(buffer);
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";

  let kind: "IMAGE" | "PDF" | "DOCX";
  let mimeType: string;

  if (detected && IMAGE_TYPES.has(detected.mime)) {
    kind = "IMAGE";
    mimeType = detected.mime;
  } else if (detected?.mime === "application/pdf") {
    kind = "PDF";
    mimeType = "application/pdf";
  } else if (
    detected?.mime === DOCX_MIME ||
    (extension === "docx" && detected?.mime === "application/zip")
  ) {
    kind = "DOCX";
    mimeType = DOCX_MIME;
  } else if (extension === "doc") {
    return NextResponse.json(
      {
        error:
          "Legacy DOC files are not supported. Save the file as DOCX or PDF and upload again.",
      },
      { status: 415 },
    );
  } else {
    return NextResponse.json(
      {
        error: `Unsupported file type. Upload ${Object.values(
          CONTENT_KIND_LABELS,
        )
          .filter((label) => label !== "DOC")
          .join(", ")}.`,
      },
      { status: 415 },
    );
  }

  const rawTitle =
    typeof formData.get("title") === "string"
      ? String(formData.get("title")).trim()
      : "";
  const fallbackTitle = file.name.replace(/\.[^.]+$/, "").slice(0, 160);
  const title = (rawTitle || fallbackTitle || "Untitled content").slice(0, 160);

  const adapter = getStorageAdapter();
  const key = buildStorageKey("content", user.id, file.name || "content");

  await adapter.putObject({
    key,
    body: buffer,
    contentType: mimeType,
  });

  try {
    const content = await db.content.create({
      data: {
        brandId,
        uploadedById: user.id,
        title,
        originalFilename: file.name.slice(0, 240),
        mimeType,
        fileSize: buffer.byteLength,
        storageKey: key,
        storageProvider: adapter.provider,
        kind,
        status: "UPLOADED",
      },
    });

    await recordAudit({
      actorId: user.id,
      action: "content.uploaded",
      entityType: "Content",
      entityId: content.id,
      contentId: content.id,
      brandId,
      metadata: {
        title,
        kind,
        mimeType,
        fileSize: buffer.byteLength,
      },
    });

    return NextResponse.json({
      content: {
        id: content.id,
        title: content.title,
        kind: content.kind,
        status: content.status,
      },
    });
  } catch (error) {
    console.error("Content record failed", error);
    await adapter.deleteObject(key).catch(() => {});
    return NextResponse.json(
      { error: "The content could not be saved. Try again." },
      { status: 500 },
    );
  }
}
