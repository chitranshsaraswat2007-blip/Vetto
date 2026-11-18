"use client";

import { useActionState, useEffect, useRef } from "react";

import { Field, Input, Select } from "@/components/ui/form";
import { SubmitButton } from "@/components/ui/submit-button";
import { roleLabels } from "@/lib/auth/permissions";
import { createUserAction } from "@/lib/users/actions";
import {
  appRoles,
  initialUserActionState,
  type UserActionState,
} from "@/lib/users/types";

function FormMessage({ state }: { state: UserActionState }) {
  if (state.error) {
    return (
      <p
        role="alert"
        className="rounded-md border border-danger/20 bg-danger-soft px-3 py-2 text-xs leading-5 text-danger"
      >
        {state.error}
      </p>
    );
  }

  if (state.success) {
    return (
      <p className="rounded-md border border-success/20 bg-success-soft px-3 py-2 text-xs leading-5 text-success">
        {state.success}
      </p>
    );
  }

  return null;
}

export function CreateUserForm() {
  const [state, formAction] = useActionState(
    createUserAction,
    initialUserActionState,
  );
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.success) {
      formRef.current?.reset();
    }
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="space-y-4">
      <FormMessage state={state} />

      <Field label="Full name" htmlFor="user-name">
        <Input
          id="user-name"
          name="name"
          required
          maxLength={80}
          placeholder="Nina Vale"
        />
      </Field>

      <Field label="Email" htmlFor="user-email">
        <Input
          id="user-email"
          name="email"
          type="email"
          required
          maxLength={254}
          placeholder="nina@company.com"
        />
      </Field>

      <Field
        label="Temporary password"
        htmlFor="user-password"
        hint="At least 10 characters. Share it with the member directly."
      >
        <Input
          id="user-password"
          name="password"
          type="password"
          required
          minLength={10}
          autoComplete="new-password"
        />
      </Field>

      <Field label="Role" htmlFor="user-role">
        <Select id="user-role" name="role" defaultValue="CREATOR">
          {appRoles.map((role) => (
            <option key={role} value={role}>
              {roleLabels[role]}
            </option>
          ))}
        </Select>
      </Field>

      <SubmitButton pendingLabel="Adding member…">Add member</SubmitButton>
    </form>
  );
}
