"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/form";
import { resendVerificationAction } from "@/lib/auth/actions";

export function ResendVerificationForm() {
  const [state, action, pending] = useActionState(resendVerificationAction, {});
  return <form action={action} className="space-y-4">
    <div><Label htmlFor="verify-email">Email</Label><Input id="verify-email" type="email" name="email" autoComplete="email" required maxLength={254} /></div>
    {state.message ? <div role="status" className="rounded-md border border-success/20 bg-success-soft px-3 py-2 text-xs text-success">
      <p>{state.message}</p>
      {state.devLink ? <a className="mt-2 inline-block underline" href={state.devLink}>Open development verification link</a> : null}
    </div> : null}
    {state.error ? <p role="alert" className="text-xs text-danger">{state.error}</p> : null}
    <Button className="w-full" type="submit" disabled={pending}>{pending ? "Sending…" : "Send verification link"}</Button>
  </form>;
}
