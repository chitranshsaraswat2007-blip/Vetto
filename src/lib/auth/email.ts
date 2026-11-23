import "server-only";

import { createHash, randomBytes } from "node:crypto";

import type { AuthTokenPurpose } from "@prisma/client";
import { db } from "@/lib/db";

const tokenLifetimeMs = 1000 * 60 * 60;

export function hashAuthToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function createAuthLink({
  userId,
  purpose,
}: {
  userId: string;
  purpose: AuthTokenPurpose;
}) {
  const token = randomBytes(32).toString("base64url");
  await db.authToken.updateMany({
    where: { userId, purpose, usedAt: null },
    data: { usedAt: new Date() },
  });
  await db.authToken.create({
    data: {
      tokenHash: hashAuthToken(token),
      purpose,
      userId,
      expiresAt: new Date(Date.now() + tokenLifetimeMs),
    },
  });
  const baseUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
  const path = purpose === "VERIFY_EMAIL" ? "/verify-email" : "/reset-password";
  return `${baseUrl}${path}?token=${encodeURIComponent(token)}`;
}

export async function sendAuthEmail({
  to,
  link,
  purpose,
}: {
  to: string;
  link: string;
  purpose: AuthTokenPurpose;
}) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.AUTH_EMAIL_FROM;
  if (!apiKey || !from) {
    if (process.env.NODE_ENV !== "production") return;
    throw new Error("Email delivery is not configured. Set RESEND_API_KEY and AUTH_EMAIL_FROM.");
  }

  const isVerification = purpose === "VERIFY_EMAIL";
  const subject = isVerification ? "Verify your VETTO email" : "Reset your VETTO password";
  const action = isVerification ? "Verify email" : "Choose a new password";
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject,
      html: `<p>${isVerification ? "Confirm your email address to finish setting up your VETTO account." : "Use the link below to reset your VETTO password."}</p><p><a href="${link}">${action}</a></p><p>This link expires in one hour. If you did not request this, you can ignore this message.</p>`,
    }),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    console.error("Auth email delivery failed", response.status, detail.slice(0, 300));
    throw new Error("Email could not be sent.");
  }
}
