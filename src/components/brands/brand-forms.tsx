"use client";

import { useActionState, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

import { Button, type ButtonProps } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { SubmitButton } from "@/components/ui/submit-button";
import {
  addColorAction,
  addFontAction,
  addRuleAction,
  createBrandAction,
  updateBrandAction,
  updateBrandProfileAction,
} from "@/lib/brands/actions";
import {
  initialActionState,
  type ActionState,
} from "@/lib/brands/types";
import { uploadWithProgress } from "@/lib/client-upload";

function FormMessage({ state }: { state: ActionState }) {
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

export function ConfirmSubmitButton({
  confirmMessage,
  children,
  ...props
}: ButtonProps & { confirmMessage: string }) {
  return (
    <Button
      type="submit"
      onClick={(event) => {
        if (!window.confirm(confirmMessage)) {
          event.preventDefault();
        }
      }}
      {...props}
    >
      {children}
    </Button>
  );
}

const statusOptions = [
  { value: "DRAFT", label: "Draft" },
  { value: "ACTIVE", label: "Active" },
  { value: "ARCHIVED", label: "Archived" },
];

export function CreateBrandForm() {
  const [state, formAction] = useActionState(
    createBrandAction,
    initialActionState,
  );

  return (
    <form action={formAction} className="space-y-5">
      <FormMessage state={state} />

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Brand name" htmlFor="name">
          <Input
            id="name"
            name="name"
            required
            maxLength={80}
            placeholder="Aurelia Coffee Roasters"
          />
        </Field>
        <Field
          label="Slug"
          htmlFor="slug"
          hint="Optional. Generated from the name when left blank."
        >
          <Input
            id="slug"
            name="slug"
            maxLength={60}
            placeholder="aurelia-coffee"
          />
        </Field>
      </div>

      <div className="grid gap-5 sm:grid-cols-[minmax(0,1fr)_12rem]">
        <Field label="Short description" htmlFor="description">
          <Textarea
            id="description"
            name="description"
            maxLength={600}
            placeholder="What the brand is and what it stands for."
          />
        </Field>
        <Field label="Status" htmlFor="status">
          <Select id="status" name="status" defaultValue="DRAFT">
            {statusOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <details className="rounded-md border border-line bg-surface-muted p-4">
        <summary className="cursor-pointer text-sm font-medium text-ink">
          Add brand intelligence now (optional)
        </summary>
        <div className="mt-4 space-y-5">
          <Field label="Brand narrative" htmlFor="profileDescription">
            <Textarea
              id="profileDescription"
              name="profileDescription"
              maxLength={1200}
              placeholder="A specialty coffee roaster with a warm, editorial voice."
            />
          </Field>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field
              label="Personality"
              htmlFor="personality"
              hint="Comma-separated, e.g. warm, considered, crafted"
            >
              <Input id="personality" name="personality" maxLength={500} />
            </Field>
            <Field label="Tone" htmlFor="tone">
              <Input
                id="tone"
                name="tone"
                maxLength={400}
                placeholder="Warm, precise, and understated."
              />
            </Field>
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Visual style" htmlFor="visualStyle">
              <Textarea
                id="visualStyle"
                name="visualStyle"
                maxLength={600}
              />
            </Field>
            <Field label="Imagery style" htmlFor="imageryStyle">
              <Textarea
                id="imageryStyle"
                name="imageryStyle"
                maxLength={600}
              />
            </Field>
          </div>
          <Field label="Design direction" htmlFor="designDirection">
            <Textarea
              id="designDirection"
              name="designDirection"
              maxLength={600}
            />
          </Field>
        </div>
      </details>

      <SubmitButton pendingLabel="Creating brand…">Create brand</SubmitButton>
    </form>
  );
}

export function BrandBasicsForm({
  brand,
}: {
  brand: {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    status: string;
  };
}) {
  const [state, formAction] = useActionState(
    updateBrandAction,
    initialActionState,
  );

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="brandId" value={brand.id} />
      <FormMessage state={state} />

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Brand name" htmlFor="name">
          <Input
            id="name"
            name="name"
            defaultValue={brand.name}
            required
            maxLength={80}
          />
        </Field>
        <Field label="Slug" htmlFor="slug">
          <Input
            id="slug"
            name="slug"
            defaultValue={brand.slug}
            maxLength={60}
          />
        </Field>
      </div>

      <div className="grid gap-5 sm:grid-cols-[minmax(0,1fr)_12rem]">
        <Field label="Short description" htmlFor="description">
          <Textarea
            id="description"
            name="description"
            defaultValue={brand.description ?? ""}
            maxLength={600}
          />
        </Field>
        <Field label="Status" htmlFor="status">
          <Select id="status" name="status" defaultValue={brand.status}>
            {statusOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <SubmitButton pendingLabel="Saving…">Save details</SubmitButton>
    </form>
  );
}

export function BrandProfileForm({
  brandId,
  profile,
}: {
  brandId: string;
  profile: {
    description: string | null;
    personality: string[];
    tone: string | null;
    visualStyle: string | null;
    imageryStyle: string | null;
    designDirection: string | null;
  } | null;
}) {
  const [state, formAction] = useActionState(
    updateBrandProfileAction,
    initialActionState,
  );

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="brandId" value={brandId} />
      <FormMessage state={state} />

      <Field label="Brand narrative" htmlFor="profile-description">
        <Textarea
          id="profile-description"
          name="description"
          defaultValue={profile?.description ?? ""}
          maxLength={1200}
        />
      </Field>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field
          label="Personality"
          htmlFor="personality"
          hint="Comma-separated traits."
        >
          <Input
            id="personality"
            name="personality"
            defaultValue={profile?.personality.join(", ") ?? ""}
            maxLength={500}
          />
        </Field>
        <Field label="Tone" htmlFor="tone">
          <Input
            id="tone"
            name="tone"
            defaultValue={profile?.tone ?? ""}
            maxLength={400}
          />
        </Field>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Visual style" htmlFor="visualStyle">
          <Textarea
            id="visualStyle"
            name="visualStyle"
            defaultValue={profile?.visualStyle ?? ""}
            maxLength={600}
          />
        </Field>
        <Field label="Imagery style" htmlFor="imageryStyle">
          <Textarea
            id="imageryStyle"
            name="imageryStyle"
            defaultValue={profile?.imageryStyle ?? ""}
            maxLength={600}
          />
        </Field>
      </div>

      <Field label="Design direction" htmlFor="designDirection">
        <Textarea
          id="designDirection"
          name="designDirection"
          defaultValue={profile?.designDirection ?? ""}
          maxLength={600}
        />
      </Field>

      <SubmitButton pendingLabel="Saving…">
        Save brand intelligence
      </SubmitButton>
    </form>
  );
}

export function AddColorForm({ brandId }: { brandId: string }) {
  const [state, formAction] = useActionState(
    addColorAction,
    initialActionState,
  );

  return (
    <form
      action={formAction}
      className="space-y-4 rounded-md border border-line bg-surface-muted p-4"
    >
      <input type="hidden" name="brandId" value={brandId} />
      <FormMessage state={state} />
      <div className="grid gap-4 sm:grid-cols-[7rem_minmax(0,1fr)]">
        <Field label="Hex" htmlFor="hex">
          <Input
            id="hex"
            name="hex"
            required
            placeholder="#C98A5B"
            pattern="^#[0-9a-fA-F]{6}$"
          />
        </Field>
        <Field label="Name" htmlFor="color-name">
          <Input
            id="color-name"
            name="name"
            maxLength={60}
            placeholder="Caramel"
          />
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
        <Field label="Usage" htmlFor="color-usage">
          <Input
            id="color-usage"
            name="usage"
            maxLength={120}
            placeholder="Accent, calls to action"
          />
        </Field>
        <label className="flex h-10 items-center gap-2 text-xs text-ink-soft">
          <input type="checkbox" name="isPrimary" className="size-4" />
          Primary color
        </label>
      </div>
      <SubmitButton size="sm" pendingLabel="Adding…">
        Add color
      </SubmitButton>
    </form>
  );
}

export function AddFontForm({ brandId }: { brandId: string }) {
  const [state, formAction] = useActionState(
    addFontAction,
    initialActionState,
  );

  return (
    <form
      action={formAction}
      className="space-y-4 rounded-md border border-line bg-surface-muted p-4"
    >
      <input type="hidden" name="brandId" value={brandId} />
      <FormMessage state={state} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Font name" htmlFor="font-name">
          <Input
            id="font-name"
            name="name"
            required
            maxLength={80}
            placeholder="Fraunces"
          />
        </Field>
        <Field label="Usage" htmlFor="font-usage">
          <Input
            id="font-usage"
            name="usage"
            maxLength={120}
            placeholder="Headlines"
          />
        </Field>
      </div>
      <label className="flex items-center gap-2 text-xs text-ink-soft">
        <input
          type="checkbox"
          name="isApproved"
          defaultChecked
          className="size-4"
        />
        Approved for use
      </label>
      <SubmitButton size="sm" pendingLabel="Adding…">
        Add font
      </SubmitButton>
    </form>
  );
}

export function AddRuleForm({ brandId }: { brandId: string }) {
  const [state, formAction] = useActionState(
    addRuleAction,
    initialActionState,
  );

  return (
    <form
      action={formAction}
      className="space-y-4 rounded-md border border-line bg-surface-muted p-4"
    >
      <input type="hidden" name="brandId" value={brandId} />
      <FormMessage state={state} />

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Rule name" htmlFor="rule-name">
          <Input
            id="rule-name"
            name="name"
            required
            maxLength={100}
            placeholder="No scientific claims"
          />
        </Field>
        <Field label="Severity" htmlFor="rule-severity">
          <Select id="rule-severity" name="severity" defaultValue="HIGH">
            <option value="CRITICAL">Critical</option>
            <option value="HIGH">High</option>
            <option value="MEDIUM">Medium</option>
            <option value="LOW">Low</option>
            <option value="INFO">Info</option>
          </Select>
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Category" htmlFor="rule-category">
          <Select
            id="rule-category"
            name="category"
            defaultValue="BRAND_IDENTITY"
          >
            <option value="BRAND_IDENTITY">Brand identity</option>
            <option value="VISUAL_QUALITY">Visual quality</option>
            <option value="BRAND_VIBE">Brand vibe</option>
            <option value="CONTENT">Content</option>
            <option value="COMPLIANCE">Compliance</option>
          </Select>
        </Field>
        <Field label="Rule type" htmlFor="rule-type">
          <Select
            id="rule-type"
            name="ruleType"
            defaultValue="FORBIDDEN_PHRASE"
          >
            <option value="FORBIDDEN_PHRASE">Forbidden phrase</option>
            <option value="REQUIRED_PHRASE">Required phrase</option>
            <option value="REQUIRED_DISCLAIMER">Required disclaimer</option>
            <option value="CLAIM_RESTRICTION">Claim restriction</option>
            <option value="KEYWORD">Keyword</option>
            <option value="TONE">Tone</option>
            <option value="VISUAL_COLOR">Visual color</option>
            <option value="VISUAL_LOGO">Visual logo</option>
            <option value="VISUAL_TYPOGRAPHY">Visual typography</option>
            <option value="OTHER">Other</option>
          </Select>
        </Field>
      </div>

      <Field label="Description" htmlFor="rule-description">
        <Textarea
          id="rule-description"
          name="description"
          required
          maxLength={1000}
          placeholder="Explain what the rule enforces and why it matters."
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Keyword or phrase"
          htmlFor="rule-keyword"
          hint="Used by phrase and disclaimer rules."
        >
          <Input
            id="rule-keyword"
            name="keyword"
            maxLength={200}
            placeholder="scientifically proven"
          />
        </Field>
        <Field
          label="Pattern"
          htmlFor="rule-pattern"
          hint="Regular expression, e.g. \b(guaranteed|miracle)\b"
        >
          <Input
            id="rule-pattern"
            name="pattern"
            maxLength={500}
            placeholder="guaranteed|miracle|cures?"
          />
        </Field>
      </div>

      <label className="flex items-center gap-2 text-xs text-ink-soft">
        <input
          type="checkbox"
          name="isActive"
          defaultChecked
          className="size-4"
        />
        Active immediately
      </label>

      <SubmitButton size="sm" pendingLabel="Adding…">
        Add rule
      </SubmitButton>
    </form>
  );
}

export function AssetUploadForm({ brandId }: { brandId: string }) {
  const [pending, setPending] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);

    setPending(true);
    setProgress(0);
    setError(null);
    setSuccess(null);

    try {
      await uploadWithProgress(
        `/api/brands/${brandId}/assets`,
        data,
        setProgress,
      );
      form.reset();
      setSuccess("Asset uploaded and pending approval.");
      router.refresh();
    } catch (uploadError) {
      setError(
        uploadError instanceof Error ? uploadError.message : "Upload failed.",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <form
      ref={formRef}
      onSubmit={handleSubmit}
      className="space-y-4 rounded-md border border-line bg-surface-muted p-4"
    >
      {error ? (
        <p
          role="alert"
          className="rounded-md border border-danger/20 bg-danger-soft px-3 py-2 text-xs leading-5 text-danger"
        >
          {error}
        </p>
      ) : null}
      {success ? (
        <p className="rounded-md border border-success/20 bg-success-soft px-3 py-2 text-xs leading-5 text-success">
          {success}
        </p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-[10rem_minmax(0,1fr)]">
        <Field label="Asset type" htmlFor="asset-kind">
          <Select id="asset-kind" name="kind" defaultValue="LOGO">
            <option value="LOGO">Logo</option>
            <option value="IMAGERY">Imagery</option>
            <option value="OTHER">Other</option>
          </Select>
        </Field>
        <Field label="Asset name" htmlFor="asset-name">
          <Input
            id="asset-name"
            name="name"
            maxLength={120}
            placeholder="Primary logo"
          />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Variant"
          htmlFor="asset-variant"
          hint="Optional, e.g. light, dark, stacked."
        >
          <Input id="asset-variant" name="variant" maxLength={80} />
        </Field>
        <Field
          label="Background context"
          htmlFor="asset-background"
          hint="Optional. Where this asset may be used."
        >
          <Input
            id="asset-background"
            name="backgroundContext"
            maxLength={120}
          />
        </Field>
      </div>

      <Field
        label="Image file"
        htmlFor="asset-file"
        hint="PNG, JPEG, or WebP up to 10 MB."
      >
        <input
          id="asset-file"
          name="file"
          type="file"
          required
          accept="image/png,image/jpeg,image/webp"
          className="mt-1.5 block w-full text-xs text-ink-soft file:mr-3 file:rounded-md file:border file:border-line-strong file:bg-surface file:px-3 file:py-2 file:text-xs file:font-medium file:text-ink hover:file:bg-surface-muted"
        />
      </Field>

      {pending ? (
        <div>
          <div
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progress}
            className="h-1.5 overflow-hidden rounded-full bg-surface-strong"
          >
            <div
              className="h-full rounded-full bg-accent transition-[width]"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="mt-1.5 text-[11px] text-ink-muted">
            Uploading… {progress}%
          </p>
        </div>
      ) : null}

      <Button type="submit" size="sm" disabled={pending}>
        {pending ? "Uploading…" : "Upload asset"}
      </Button>
    </form>
  );
}
