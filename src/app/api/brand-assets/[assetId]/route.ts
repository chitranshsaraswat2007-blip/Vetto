import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { getStorageAdapter } from "@/lib/storage";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ assetId: string }> },
) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const { assetId } = await params;
  const asset = await db.brandAsset.findUnique({ where: { id: assetId } });

  if (!asset) {
    return NextResponse.json({ error: "Asset not found." }, { status: 404 });
  }

  try {
    const buffer = await getStorageAdapter().getObject(asset.storageKey);
    const filename = asset.name.replace(/["\\\r\n]/g, "").slice(0, 120);

    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": asset.mimeType ?? "application/octet-stream",
        "Content-Length": String(buffer.byteLength),
        "Content-Disposition": `inline; filename="${filename || "asset"}"`,
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (error) {
    console.error("Failed to load brand asset", error);
    return NextResponse.json(
      { error: "The asset file could not be loaded." },
      { status: 500 },
    );
  }
}
