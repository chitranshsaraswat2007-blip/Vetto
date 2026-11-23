"use client";

import {
  AlertCircle,
  ArrowRight,
  Eye,
  EyeOff,
  LoaderCircle,
  ShieldCheck,
} from "lucide-react";
import {
  useActionState,
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/form";
import { loginAction, registerAction } from "@/lib/auth/actions";
import type {
  LoginState,
  RegisterState,
  RegistrationField,
} from "@/lib/auth/types";
import { cn } from "@/lib/utils";

export type DevelopmentAccount = {
  role: string;
  email: string;
  password: string;
};

type AuthMode = "signin" | "signup";
type SignUpValues = Record<RegistrationField, string>;
type FieldErrors = Partial<Record<RegistrationField, string>>;

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateEmail(value: string) {
  if (!value.trim()) {
    return "Enter your email address.";
  }

  if (!emailPattern.test(value.trim())) {
    return "Enter a valid email address.";
  }

  return undefined;
}

function validateSignUp(values: SignUpValues): FieldErrors {
  const errors: FieldErrors = {};

  if (values.fullName.trim().length < 2) {
    errors.fullName = "Enter your full name.";
  }

  const emailError = validateEmail(values.email);
  if (emailError) {
    errors.email = emailError;
  }

  if (values.password.length < 10) {
    errors.password = "Use at least 10 characters.";
  } else if (new TextEncoder().encode(values.password).length > 72) {
    errors.password = "Password must be 72 bytes or fewer.";
  }

  if (!values.confirmPassword) {
    errors.confirmPassword = "Confirm your password.";
  } else if (values.confirmPassword !== values.password) {
    errors.confirmPassword = "Passwords do not match.";
  }

  return errors;
}

function passwordScore(value: string) {
  if (value.length < 10) {
    return 0;
  }

  let score = 1;

  if (value.length >= 14) {
    score += 1;
  }

  if (/[a-z]/.test(value) && /[A-Z]/.test(value)) {
    score += 1;
  }

  if (/\d/.test(value) && /[^A-Za-z0-9]/.test(value)) {
    score += 1;
  }

  return Math.min(score, 4);
}

function validationSummary(errors: FieldErrors) {
  return Object.values(errors).some(Boolean);
}

function focusField(form: HTMLFormElement, field: RegistrationField) {
  form.querySelector<HTMLElement>(`[name="${field}"]`)?.focus();
}

function FieldError({ id, children }: { id: string; children?: string }) {
  if (!children) {
    return null;
  }

  return (
    <p
      id={id}
      className="mt-1.5 flex items-start gap-1.5 text-[11px] leading-5 text-danger"
    >
      <AlertCircle aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
      <span>{children}</span>
    </p>
  );
}

function PasswordInput({
  id,
  name,
  value,
  onChange,
  onBlur,
  autoComplete,
  placeholder,
  invalid,
  describedBy,
}: {
  id: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  autoComplete: string;
  placeholder: string;
  invalid?: boolean;
  describedBy?: string;
}) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative mt-1.5">
      <Input
        id={id}
        name={name}
        type={visible ? "text" : "password"}
        autoComplete={autoComplete}
        required
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onBlur={onBlur}
        placeholder={placeholder}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        className={cn(
          "mt-0 h-11 rounded-lg pr-11 text-base sm:text-sm",
          invalid &&
            "border-danger hover:border-danger focus:border-danger focus:ring-danger/15",
        )}
      />
      <button
        type="button"
        onClick={() => setVisible((current) => !current)}
        aria-label={visible ? "Hide password" : "Show password"}
        aria-pressed={visible}
        className="absolute inset-y-0 right-1 flex w-9 items-center justify-center rounded-md text-ink-muted transition-colors hover:bg-surface-muted hover:text-ink"
      >
        {visible ? (
          <EyeOff aria-hidden="true" className="size-4" />
        ) : (
          <Eye aria-hidden="true" className="size-4" />
        )}
      </button>
    </div>
  );
}

function PasswordStrength({ password }: { password: string }) {
  if (!password) {
    return (
      <p className="mt-1.5 text-[11px] leading-5 text-ink-muted">
        Use 10 or more characters. Longer passwords are stronger.
      </p>
    );
  }

  const score = passwordScore(password);
  const label = ["Too short", "Basic", "Fair", "Strong", "Excellent"][score];

  return (
    <div className="mt-2">
      <div
        role="meter"
        aria-label="Password strength"
        aria-valuemin={0}
        aria-valuemax={4}
        aria-valuenow={score}
        aria-valuetext={label}
        className="flex gap-1"
      >
        {[0, 1, 2, 3].map((index) => (
          <span
            key={index}
            className={cn(
              "h-1 flex-1 rounded-full transition-colors duration-300",
              index < score
                ? score === 1
                  ? "bg-danger"
                  : score === 2
                    ? "bg-warning"
                    : score === 3
                      ? "bg-accent"
                      : "bg-success"
                : "bg-line",
            )}
          />
        ))}
      </div>
      <p className="mt-1.5 text-[10px] uppercase tracking-[0.14em] text-ink-muted">
        {label}
      </p>
    </div>
  );
}

function FormError({ children }: { children?: ReactNode }) {
  if (!children) {
    return null;
  }

  return (
    <div
      role="alert"
      className="flex items-start gap-2 rounded-lg border border-danger/20 bg-danger-soft/80 px-3 py-2.5 text-xs leading-5 text-danger"
    >
      <AlertCircle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
      <span>{children}</span>
    </div>
  );
}

function SignInForm({
  developmentAccounts,
  preselectedAccount,
}: {
  developmentAccounts: DevelopmentAccount[];
  preselectedAccount?: DevelopmentAccount | null;
}) {
  const [state, formAction, pending] = useActionState<LoginState, FormData>(
    loginAction,
    {},
  );
  const formId = useId();
  const firstAccount = preselectedAccount ?? developmentAccounts[0];
  const [email, setEmail] = useState(firstAccount?.email ?? "");
  const [password, setPassword] = useState(firstAccount?.password ?? "");
  const [touched, setTouched] = useState({ email: false, password: false });
  const [submitted, setSubmitted] = useState(false);

  const errors = {
    email: validateEmail(email),
    password: password ? undefined : "Enter your password.",
  };

  const emailError = (touched.email || submitted) ? errors.email : undefined;
  const passwordError =
    (touched.password || submitted) ? errors.password : undefined;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    setSubmitted(true);

    if (errors.email || errors.password) {
      event.preventDefault();
      const firstInvalid = errors.email ? "email" : "password";
      focusField(event.currentTarget, firstInvalid);
    }
  }

  return (
    <div>
      <form action={formAction} onSubmit={handleSubmit} noValidate className="space-y-4">
        <div>
          <Label
            htmlFor={`${formId}-email`}
            className="text-[10px] uppercase tracking-[0.14em]"
          >
            Email
          </Label>
          <Input
            id={`${formId}-email`}
            name="email"
            type="email"
            autoComplete="username"
            inputMode="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            onBlur={() => setTouched((current) => ({ ...current, email: true }))}
            placeholder="you@company.com"
            aria-invalid={emailError ? true : undefined}
            aria-describedby={emailError ? `${formId}-email-error` : undefined}
            className={cn(
              "h-11 rounded-lg text-base sm:text-sm",
              emailError &&
                "border-danger hover:border-danger focus:border-danger focus:ring-danger/15",
            )}
          />
          <FieldError id={`${formId}-email-error`}>{emailError}</FieldError>
        </div>

        <div>
          <Label
            htmlFor={`${formId}-password`}
            className="text-[10px] uppercase tracking-[0.14em]"
          >
            Password
          </Label>
          <PasswordInput
            id={`${formId}-password`}
            name="password"
            value={password}
            onChange={setPassword}
            onBlur={() =>
              setTouched((current) => ({ ...current, password: true }))
            }
            autoComplete="current-password"
            placeholder="Enter your password"
            invalid={Boolean(passwordError)}
            describedBy={
              passwordError ? `${formId}-password-error` : undefined
            }
          />
          <FieldError id={`${formId}-password-error`}>{passwordError}</FieldError>
        </div>

        <FormError>{state.error}</FormError>

        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
          <Link href="/forgot-password" className="text-accent hover:text-accent-strong">Forgot password?</Link>
          <Link href="/resend-verification" className="text-accent hover:text-accent-strong">Resend verification email</Link>
        </div>

        <Button
          type="submit"
          size="lg"
          className="group h-11 w-full rounded-lg"
          disabled={pending}
        >
          {pending ? (
            <>
              Signing in
              <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
            </>
          ) : (
            <>
              Sign in
              <ArrowRight
                aria-hidden="true"
                className="size-4 transition-transform group-hover:translate-x-0.5"
              />
            </>
          )}
        </Button>
      </form>

    </div>
  );
}

function SignUpForm() {
  const [state, formAction, pending] = useActionState<RegisterState, FormData>(
    registerAction,
    {},
  );
  const formId = useId();
  const formRef = useRef<HTMLFormElement>(null);
  const [values, setValues] = useState<SignUpValues>({
    fullName: "",
    email: "",
    password: "",
    confirmPassword: "",
    role: "CREATOR",
  });
  const [touched, setTouched] = useState<Partial<Record<RegistrationField, boolean>>>({});
  const [submitted, setSubmitted] = useState(false);
  const [clearedServerFields, setClearedServerFields] = useState<
    RegistrationField[]
  >([]);
  const [serverErrorDismissed, setServerErrorDismissed] = useState(false);
  const previousStateRef = useRef(state);

  useEffect(() => {
    if (previousStateRef.current === state) {
      return;
    }

    previousStateRef.current = state;

    const firstInvalid = (
      ["fullName", "email", "password", "confirmPassword", "role"] as const
    ).find((field) => state.fieldErrors?.[field]);

    if (firstInvalid) {
      requestAnimationFrame(() => {
        if (formRef.current) {
          focusField(formRef.current, firstInvalid);
        }
      });
    }
  }, [state]);

  const serverErrors = state.fieldErrors ?? {};
  const serverFieldError = (field: RegistrationField) =>
    clearedServerFields.includes(field) ? undefined : serverErrors[field];

  const clientErrors = validateSignUp(values);
  const fullNameError =
    serverFieldError("fullName") ??
    ((touched.fullName || submitted) ? clientErrors.fullName : undefined);
  const emailError =
    serverFieldError("email") ??
    ((touched.email || submitted) ? clientErrors.email : undefined);
  const passwordError =
    serverFieldError("password") ??
    ((touched.password || submitted) ? clientErrors.password : undefined);
  const confirmPasswordError =
    serverFieldError("confirmPassword") ??
    ((touched.confirmPassword || submitted)
      ? clientErrors.confirmPassword
      : undefined);
  const serverError = serverErrorDismissed ? undefined : state.error;

  function updateField(field: RegistrationField, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
    setClearedServerFields((current) =>
      current.includes(field) ? current : [...current, field],
    );
    setServerErrorDismissed(true);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    setSubmitted(true);
    setClearedServerFields([]);
    setServerErrorDismissed(false);

    if (validationSummary(clientErrors)) {
      event.preventDefault();

      const firstInvalid = (
        ["fullName", "email", "password", "confirmPassword", "role"] as const
      ).find((field) => clientErrors[field]);

      if (firstInvalid) {
        focusField(event.currentTarget, firstInvalid);
      }
    }
  }

  return (
    <form
      ref={formRef}
      action={formAction}
      onSubmit={handleSubmit}
      noValidate
      className="space-y-4"
    >
      <div>
        <Label
          htmlFor={`${formId}-name`}
          className="text-[10px] uppercase tracking-[0.14em]"
        >
          Full name
        </Label>
        <Input
          id={`${formId}-name`}
          name="fullName"
          type="text"
          autoComplete="name"
          required
          value={values.fullName}
          onChange={(event) => updateField("fullName", event.target.value)}
          onBlur={() => setTouched((current) => ({ ...current, fullName: true }))}
          placeholder="Alex Morgan"
          aria-invalid={fullNameError ? true : undefined}
          aria-describedby={
            fullNameError ? `${formId}-name-error` : undefined
          }
          className={cn(
            "h-11 rounded-lg text-base sm:text-sm",
            fullNameError &&
              "border-danger hover:border-danger focus:border-danger focus:ring-danger/15",
          )}
        />
        <FieldError id={`${formId}-name-error`}>{fullNameError}</FieldError>
      </div>

      <div>
        <Label
          htmlFor={`${formId}-email`}
          className="text-[10px] uppercase tracking-[0.14em]"
        >
          Work email
        </Label>
        <Input
          id={`${formId}-email`}
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          required
          value={values.email}
          onChange={(event) => updateField("email", event.target.value)}
          onBlur={() => setTouched((current) => ({ ...current, email: true }))}
          placeholder="you@company.com"
          aria-invalid={emailError ? true : undefined}
          aria-describedby={emailError ? `${formId}-email-error` : undefined}
          className={cn(
            "h-11 rounded-lg text-base sm:text-sm",
            emailError &&
              "border-danger hover:border-danger focus:border-danger focus:ring-danger/15",
          )}
        />
        <FieldError id={`${formId}-email-error`}>{emailError}</FieldError>
      </div>

      <div>
        <Label className="text-[10px] uppercase tracking-[0.14em]">
          Account role
        </Label>
        <input type="hidden" name="role" value="CREATOR" />
        <p className="mt-1.5 text-sm font-medium text-ink">Creator</p>
        <p className="mt-1.5 text-[11px] leading-5 text-ink-muted">
          New accounts start as Creators. An Admin can assign Manager, Supervisor, or Admin access when needed.
        </p>
      </div>

      <div>
        <Label
          htmlFor={`${formId}-password`}
          className="text-[10px] uppercase tracking-[0.14em]"
        >
          Password
        </Label>
        <PasswordInput
          id={`${formId}-password`}
          name="password"
          value={values.password}
          onChange={(value) => updateField("password", value)}
          onBlur={() =>
            setTouched((current) => ({ ...current, password: true }))
          }
          autoComplete="new-password"
          placeholder="Create a password"
          invalid={Boolean(passwordError)}
          describedBy={
            passwordError
              ? `${formId}-password-error`
              : `${formId}-password-hint`
          }
        />
        <FieldError id={`${formId}-password-error`}>{passwordError}</FieldError>
        <div id={`${formId}-password-hint`}>
          <PasswordStrength password={values.password} />
        </div>
      </div>

      <div>
        <Label
          htmlFor={`${formId}-confirm-password`}
          className="text-[10px] uppercase tracking-[0.14em]"
        >
          Confirm password
        </Label>
        <PasswordInput
          id={`${formId}-confirm-password`}
          name="confirmPassword"
          value={values.confirmPassword}
          onChange={(value) => updateField("confirmPassword", value)}
          onBlur={() =>
            setTouched((current) => ({ ...current, confirmPassword: true }))
          }
          autoComplete="new-password"
          placeholder="Repeat your password"
          invalid={Boolean(confirmPasswordError)}
          describedBy={
            confirmPasswordError
              ? `${formId}-confirm-password-error`
              : undefined
          }
        />
        <FieldError id={`${formId}-confirm-password-error`}>
          {confirmPasswordError}
        </FieldError>
      </div>

      <div className="flex items-start gap-2.5 rounded-lg border border-line/80 bg-surface-muted/60 px-3 py-2.5">
        <ShieldCheck
          aria-hidden="true"
          className="mt-0.5 size-4 shrink-0 text-success"
        />
        <p className="text-[11px] leading-5 text-ink-soft">
          Your account will be created with the selected role.
        </p>
      </div>

      {state.message ? (
        <div role="status" className="rounded-lg border border-success/20 bg-success-soft px-3 py-2.5 text-xs leading-5 text-success">
          <p>{state.message}</p>
          {state.devLink ? <a className="mt-2 inline-block underline" href={state.devLink}>Open development verification link</a> : null}
          <p className="mt-1">Already verified? <Link href="/login" className="underline">Sign in</Link></p>
        </div>
      ) : <FormError>{serverError}</FormError>}

      <Button
        type="submit"
        size="lg"
        className="group h-11 w-full rounded-lg"
        disabled={pending}
      >
        {pending ? (
          <>
            Creating account
            <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
          </>
        ) : (
          <>
            Create account
            <ArrowRight
              aria-hidden="true"
              className="size-4 transition-transform group-hover:translate-x-0.5"
            />
          </>
        )}
      </Button>
    </form>
  );
}

export function AuthPanel({
  developmentAccounts = [],
  preselectedAccount,
}: {
  developmentAccounts?: DevelopmentAccount[];
  preselectedAccount?: DevelopmentAccount | null;
}) {
  const [mode, setMode] = useState<AuthMode>("signin");
  const contentRef = useRef<HTMLDivElement>(null);
  const [contentHeight, setContentHeight] = useState<number>();

  useEffect(() => {
    const node = contentRef.current;
    if (!node) {
      return;
    }

    const updateHeight = () => setContentHeight(Math.ceil(node.getBoundingClientRect().height) + 2);
    updateHeight();

    const observer = new ResizeObserver(updateHeight);
    observer.observe(node);

    return () => observer.disconnect();
  }, []);

  const isSignIn = mode === "signin";

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-ink-muted">
          Secure workspace
        </p>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface/60 px-2.5 py-1 text-[9px] font-medium uppercase tracking-[0.12em] text-ink-muted">
          <ShieldCheck aria-hidden="true" className="size-3 text-success" />
          Encrypted session
        </span>
      </div>

      <h2 className="mt-5 font-display text-[2.15rem] leading-[1.08] text-ink">
        {isSignIn ? "Welcome back." : "Create your account."}
      </h2>
      <p className="mt-2 max-w-sm text-sm leading-6 text-ink-soft">
        {isSignIn
          ? "Sign in to keep your brand work moving."
          : "Choose your role and put every asset through a sharper review."}
      </p>

      <div
        role="group"
        aria-label="Choose sign in or create account"
        className="auth-mode-switch mt-6"
      >
        <span
          aria-hidden="true"
          className={`auth-mode-indicator ${isSignIn ? "is-signin" : "is-signup"}`}
        />
        <button
          type="button"
          onClick={() => setMode("signin")}
          aria-pressed={isSignIn}
          className={cn("auth-mode-option", isSignIn ? "is-active" : "")}
        >
          Sign in
        </button>
        <button
          type="button"
          onClick={() => setMode("signup")}
          aria-pressed={!isSignIn}
          className={cn("auth-mode-option", !isSignIn ? "is-active" : "")}
        >
          Create account
        </button>
      </div>

      <div
        className="auth-form-height mt-1 overflow-hidden transition-[height] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none"
        style={contentHeight !== undefined ? { height: contentHeight } : undefined}
      >
        <div ref={contentRef} className="pt-7">
          <div
            key={`${mode}-${preselectedAccount?.role ?? "portal"}`}
            className="auth-form-swap"
          >
            {isSignIn ? (
              <SignInForm
                key={preselectedAccount?.email ?? "default"}
                developmentAccounts={developmentAccounts}
                preselectedAccount={preselectedAccount}
              />
            ) : (
              <SignUpForm />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
