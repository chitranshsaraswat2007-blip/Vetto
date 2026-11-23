import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/form";
import {
  resetPasswordAction,
  verifyEmailAction,
} from "@/lib/auth/actions";

export function AuthFrame({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-5 py-12">
      <Link href="/login" className="mb-8 text-xs text-ink-muted hover:text-ink">← Back to VETTO sign in</Link>
      <section className="rounded-2xl border border-line bg-surface p-6 shadow-sm sm:p-8">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-accent">Account access</p>
        <h1 className="mt-2 font-display text-3xl text-ink">{title}</h1>
        <div className="mt-5">{children}</div>
      </section>
    </main>
  );
}

export function VerifyEmailForm({ token, result }: { token?: string; result?: string }) {
  return <AuthFrame title="Verify your email">
    {result === "success" ? <p role="status" className="text-sm leading-6 text-success">Email verified. You can now sign in.</p> : result === "invalid" || !token ? <p role="alert" className="text-sm leading-6 text-danger">This verification link is invalid or expired. Request another link and try again.</p> : <>
      <p className="mb-5 text-sm leading-6 text-ink-soft">Confirm this email address to activate sign in.</p>
      <form action={verifyEmailAction}><input type="hidden" name="token" value={token} /><Button className="w-full" type="submit">Verify email</Button></form>
    </>}
  </AuthFrame>;
}

export function ResetPasswordForm({ token, result }: { token?: string; result?: string }) {
  if (!token || result === "invalid") return <AuthFrame title="Reset your password"><p role="alert" className="text-sm leading-6 text-danger">This reset link is invalid or expired. Request a new one.</p></AuthFrame>;
  return <AuthFrame title="Choose a new password">
    {result === "invalid-input" ? <p role="alert" className="mb-4 text-sm text-danger">Use a password with at least 10 characters, and make sure both entries match.</p> : null}
    <form action={resetPasswordAction} className="space-y-4">
      <input type="hidden" name="token" value={token} />
      <div><Label htmlFor="new-password">New password</Label><Input id="new-password" name="password" type="password" autoComplete="new-password" minLength={10} maxLength={72} required /></div>
      <div><Label htmlFor="confirm-password">Confirm password</Label><Input id="confirm-password" name="confirmPassword" type="password" autoComplete="new-password" minLength={10} maxLength={72} required /></div>
      <Button className="w-full" type="submit">Update password</Button>
    </form>
  </AuthFrame>;
}
