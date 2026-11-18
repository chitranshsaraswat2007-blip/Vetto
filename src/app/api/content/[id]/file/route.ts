import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth/session";
import { canViewContent } from "@/lib/content/access";
import { db } from "@/lib/db";
import { getStorageAdapter } from "@/lib/storage";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json(
      { error: "Authentication required." },
      { status: 401 },
    );
  }

  const { id } = await params;
  const content = await db.content.findUnique({ where: { id } });

  if (!content) {
    return NextResponse.json({ error: "Content not found." }, { status: 404 });
  }

  if (!(await canViewContent(user, content))) {
    return NextResponse.json(
      { error: "You do not have access to this content." },
      { status: 403 },
    );
  }

  try {
    const buffer = await getStorageAdapter().getObject(content.storageKey);
    const disposition =
      content.kind === "IMAGE" || content.kind === "PDF" ? "inline" : "attachment";
    const filename = content.originalFilename
      .replace(/["\\\r\n]/g, "")
      .slice(0, 160);

    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": content.mimeType,
        "Content-Length": String(buffer.byteLength),
        "Content-Disposition": `${disposition}; filename="${filename || "content"}"`,
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (error) {
    console.error("Failed to load content file", error);
    return NextResponse.json(
      { error: "The content file could not be loaded." },
      { status: 500 },
    );
  }
}
