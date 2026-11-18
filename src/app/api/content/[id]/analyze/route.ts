import { NextResponse } from "next/server";

import { runAnalysis } from "@/lib/analysis/run";
import { getCurrentUser } from "@/lib/auth/session";
import { canProcessContent } from "@/lib/content/access";
import { db } from "@/lib/db";

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
      { error: "You do not have permission to analyze this content." },
      { status: 403 },
    );
  }

  try {
    const result = await runAnalysis(content.id, user.id);
    return NextResponse.json({ analysis: result });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Analysis failed.";
    console.error("Analysis request failed", error);
    const status =
      /locked|already being processed|must complete/.test(message) ? 409 : 500;

    return NextResponse.json({ error: message }, { status });
  }
}
