import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthFrame, VerifyEmailForm } from "@/components/auth/email-auth-forms";

export const metadata: Metadata = { title: "Verify email" };

async function VerifyEmailDetails({ searchParams }: { searchParams: Promise<{ token?: string; result?: string }> }) {
  const params = await searchParams;
  return <VerifyEmailForm token={params.token} result={params.result} />;
}

export default function VerifyEmailPage({ searchParams }: { searchParams: Promise<{ token?: string; result?: string }> }) {
  return <Suspense fallback={<AuthFrame title="Verify your email"><p className="text-sm text-ink-muted">Loading verification…</p></AuthFrame>}><VerifyEmailDetails searchParams={searchParams} /></Suspense>;
}
