import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth/session";
import { canProcessContent } from "@/lib/content/access";
import { db } from "@/lib/db";
import { runExtraction } from "@/lib/extraction/run";

export const maxDuration = 60;

export async function POST(
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

  if (!canProcessContent(user, content)) {
    return NextResponse.json(
      { error: "You do not have permission to process this content." },
      { status: 403 },
    );
  }

  if (content.status === "PROCESSING" || content.status === "ANALYZING") {
    return NextResponse.json(
      { error: "This content is already being processed." },
      { status: 409 },
    );
  }

  if (content.status === "SUBMITTED" || content.status === "APPROVED") {
    return NextResponse.json(
      {
        error:
          "This content is locked by its review state and cannot be re-extracted.",
      },
      { status: 409 },
    );
  }

  try {
    const result = await runExtraction(content.id, user.id);

    return NextResponse.json({
      extraction: {
        textLength: result.text.length,
        data: result.data,
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Extraction failed.";
    console.error("Extraction request failed", error);
    const status =
      /locked|already being processed/.test(message) ? 409 : 500;

    return NextResponse.json({ error: message }, { status });
  }
}
