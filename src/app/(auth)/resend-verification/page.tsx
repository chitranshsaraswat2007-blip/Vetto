import type { Metadata } from "next";
import { AuthFrame } from "@/components/auth/email-auth-forms";
import { ResendVerificationForm } from "@/components/auth/resend-verification-form";

export const metadata: Metadata = { title: "Resend verification" };

export default function ResendVerificationPage() {
  return <AuthFrame title="Resend verification">
    <p className="mb-5 text-sm leading-6 text-ink-soft">Enter your account email. If it still needs verification, we’ll send a fresh link.</p>
    <ResendVerificationForm />
  </AuthFrame>;
}
