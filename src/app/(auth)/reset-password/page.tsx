import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthFrame, ResetPasswordForm } from "@/components/auth/email-auth-forms";

export const metadata: Metadata = { title: "Reset password" };

async function ResetPasswordDetails({ searchParams }: { searchParams: Promise<{ token?: string; result?: string }> }) {
  const params = await searchParams;
  return <ResetPasswordForm token={params.token} result={params.result} />;
}

export default function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string; result?: string }> }) {
  return <Suspense fallback={<AuthFrame title="Choose a new password"><p className="text-sm text-ink-muted">Loading secure reset form…</p></AuthFrame>}><ResetPasswordDetails searchParams={searchParams} /></Suspense>;
}
