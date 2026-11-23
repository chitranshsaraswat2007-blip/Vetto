import type { Metadata } from "next";
import { AuthFrame } from "@/components/auth/email-auth-forms";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";

export const metadata: Metadata = { title: "Forgot password" };

export default function ForgotPasswordPage() {
  return <AuthFrame title="Reset your password"><ForgotPasswordForm /></AuthFrame>;
}
