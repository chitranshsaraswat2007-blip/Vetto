import { NextResponse } from "next/server";

import { db } from "@/lib/db";

export async function GET() {
  const startedAt = Date.now();
  const checkedAt = new Date().toISOString();

  try {
    await db.$queryRaw`SELECT 1`;

    return NextResponse.json(
      {
        status: "ok",
        service: "vetto",
        database: "connected",
        latencyMs: Date.now() - startedAt,
        checkedAt,
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (error) {
    console.error("Health check failed", error);

    return NextResponse.json(
      {
        status: "degraded",
        service: "vetto",
        database: "unavailable",
        checkedAt,
      },
      {
        status: 503,
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  }
}
