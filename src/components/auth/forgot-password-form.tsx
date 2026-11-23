"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/form";
import { requestPasswordResetAction } from "@/lib/auth/actions";

export function ForgotPasswordForm() {
  const [state, action, pending] = useActionState(requestPasswordResetAction, {});
  return <>
    <p className="mb-5 text-sm leading-6 text-ink-soft">Enter your account email. We’ll send a secure reset link if an account matches.</p>
    <form action={action} className="space-y-4">
      <div><Label htmlFor="reset-email">Email</Label><Input id="reset-email" type="email" name="email" autoComplete="email" required maxLength={254} /></div>
      {state.message ? <div role="status" className="rounded-md border border-success/20 bg-success-soft px-3 py-2 text-xs text-success">
        <p>{state.message}</p>
        {state.devLink ? <a className="mt-2 inline-block underline" href={state.devLink}>Open development reset link</a> : null}
      </div> : null}
      <Button className="w-full" type="submit" disabled={pending}>{pending ? "Sending…" : "Send reset link"}</Button>
    </form>
  </>;
}
