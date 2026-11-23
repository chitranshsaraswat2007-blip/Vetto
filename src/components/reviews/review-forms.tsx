"use client";

import { useActionState, useState } from "react";

import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { SubmitButton } from "@/components/ui/submit-button";
import {
  addReviewCommentAction,
  assignSupervisorReviewAction,
  createSupervisorEscalationAction,
  reviewDecisionAction,
  resolveSupervisorEscalationAction,
  submitForReviewAction,
  updateFindingStatusAction,
} from "@/lib/reviews/actions";
import {
  findingStatusLabels,
  findingStatuses,
  initialReviewState,
  type ReviewActionState,
} from "@/lib/reviews/types";

function ReviewMessage({ state }: { state: ReviewActionState }) {
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

export function SubmitForReviewForm({
  contentId,
  resubmission = false,
}: {
  contentId: string;
  resubmission?: boolean;
}) {
  const [state, formAction] = useActionState(
    submitForReviewAction,
    initialReviewState,
  );

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="contentId" value={contentId} />
      <Field
        label="Note for the reviewer"
        htmlFor={`submit-review-note-${contentId}`}
        hint="Optional. Recorded in the review history."
      >
        <Textarea
          id={`submit-review-note-${contentId}`}
          name="comment"
          maxLength={2000}
          className="min-h-16"
          placeholder="Context the reviewer should know."
        />
      </Field>
      <ReviewMessage state={state} />
      <SubmitButton size="sm" pendingLabel="Submitting…">
        {resubmission ? "Resubmit for review" : "Submit for review"}
      </SubmitButton>
    </form>
  );
}

export function ReviewDecisionForm({ contentId }: { contentId: string }) {
  const [state, formAction] = useActionState(
    reviewDecisionAction,
    initialReviewState,
  );

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="contentId" value={contentId} />
      <Field
        label="Review note"
        htmlFor={`review-note-${contentId}`}
        hint="Required when requesting changes. Optional when approving."
      >
        <Textarea
          id={`review-note-${contentId}`}
          name="comment"
          maxLength={2000}
          className="min-h-20"
          placeholder="What did you decide, and why?"
        />
      </Field>
      <ReviewMessage state={state} />
      <div className="flex flex-wrap items-center gap-2">
        <SubmitButton
          name="decision"
          value="APPROVED"
          size="sm"
          pendingLabel="Recording…"
        >
          Approve
        </SubmitButton>
        <SubmitButton
          name="decision"
          value="CHANGES_REQUESTED"
          variant="secondary"
          size="sm"
          pendingLabel="Recording…"
        >
          Request changes
        </SubmitButton>
      </div>
    </form>
  );
}

export function ReviewCommentForm({
  contentId,
  label = "Add a review comment",
  placeholder = "Ask a question or leave context for the review history.",
  submitLabel = "Comment",
}: {
  contentId: string;
  label?: string;
  placeholder?: string;
  submitLabel?: string;
}) {
  const [state, formAction] = useActionState(
    addReviewCommentAction,
    initialReviewState,
  );

  return (
    <form action={formAction} className="space-y-2">
      <input type="hidden" name="contentId" value={contentId} />
      <label htmlFor={`review-comment-${contentId}`} className="sr-only">
        {label}
      </label>
      <Textarea
        id={`review-comment-${contentId}`}
        name="comment"
        required
        maxLength={2000}
        className="min-h-16"
        placeholder={placeholder}
      />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <ReviewMessage state={state} />
        <SubmitButton
          size="sm"
          variant="secondary"
          pendingLabel="Posting…"
          className="ml-auto"
        >
          {submitLabel}
        </SubmitButton>
      </div>
    </form>
  );
}

export function AssignSupervisorReviewForm({
  contentId,
  supervisors,
  assignedSupervisorId,
}: {
  contentId: string;
  supervisors: { id: string; name: string }[];
  assignedSupervisorId?: string;
}) {
  const [state, formAction] = useActionState(assignSupervisorReviewAction, initialReviewState);
  return (
    <form action={formAction} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="contentId" value={contentId} />
      <Field label="Assign secondary review" htmlFor={`supervisor-${contentId}`}>
        <Select id={`supervisor-${contentId}`} name="supervisorId" defaultValue={assignedSupervisorId ?? ""} required>
          <option value="" disabled>Select a Supervisor</option>
          {supervisors.map((supervisor) => <option key={supervisor.id} value={supervisor.id}>{supervisor.name}</option>)}
        </Select>
      </Field>
      <SubmitButton size="sm" variant="secondary" pendingLabel="Assigning…">{assignedSupervisorId ? "Reassign" : "Assign"}</SubmitButton>
      <ReviewMessage state={state} />
    </form>
  );
}

export function SupervisorEscalationForm({
  contentId,
  supervisors,
}: {
  contentId: string;
  supervisors: { id: string; name: string }[];
}) {
  const [state, formAction] = useActionState(
    createSupervisorEscalationAction,
    initialReviewState,
  );

  return (
    <form action={formAction} className="space-y-3 rounded-md border border-line bg-surface-muted p-4">
      <input type="hidden" name="contentId" value={contentId} />
      <p className="text-xs font-medium text-ink">Ask a Supervisor for a second opinion</p>
      <Field label="Assign to Supervisor" htmlFor={`escalation-supervisor-${contentId}`}>
        <Select id={`escalation-supervisor-${contentId}`} name="supervisorId" required defaultValue="">
          <option value="" disabled>Select a Supervisor</option>
          {supervisors.map((supervisor) => (
            <option key={supervisor.id} value={supervisor.id}>{supervisor.name}</option>
          ))}
        </Select>
      </Field>
      <Field
        label="What needs their judgment?"
        htmlFor={`escalation-question-${contentId}`}
        hint="The Manager decision will pause until the Supervisor responds."
      >
        <Textarea
          id={`escalation-question-${contentId}`}
          name="question"
          required
          minLength={5}
          maxLength={2000}
          className="min-h-20"
          placeholder="Explain what is uncertain and which finding or evidence needs review."
        />
      </Field>
      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton size="sm" variant="secondary" pendingLabel="Escalating…">
          Escalate to Supervisor
        </SubmitButton>
        <ReviewMessage state={state} />
      </div>
    </form>
  );
}

export function ResolveSupervisorEscalationForm({
  escalationId,
  question,
}: {
  escalationId: string;
  question: string;
}) {
  const [state, formAction] = useActionState(
    resolveSupervisorEscalationAction,
    initialReviewState,
  );

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="escalationId" value={escalationId} />
      <blockquote className="rounded-md border border-line bg-surface px-3 py-2.5 text-xs leading-5 text-ink-soft">
        <span className="mb-1 block text-[10px] font-medium uppercase tracking-[0.14em] text-ink-muted">Manager’s question</span>
        {question}
      </blockquote>
      <Field
        label="Supervisor assessment"
        htmlFor={`escalation-resolution-${escalationId}`}
        hint="Explain your decision so the Manager can act on it."
      >
        <Textarea
          id={`escalation-resolution-${escalationId}`}
          name="resolution"
          required
          minLength={5}
          maxLength={2000}
          className="min-h-24"
          placeholder="Record your independent assessment and supporting context."
        />
      </Field>
      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton size="sm" pendingLabel="Recording…">
          Return decision to Manager
        </SubmitButton>
        <ReviewMessage state={state} />
      </div>
    </form>
  );
}

export function FindingStatusForm({
  findingId,
  status,
}: {
  findingId: string;
  status: string;
}) {
  const [state, formAction] = useActionState(
    updateFindingStatusAction,
    initialReviewState,
  );
  // Controlled so a validation error does not discard the reviewer's choice.
  const [selectedStatus, setSelectedStatus] = useState(status);
  const [note, setNote] = useState("");

  return (
    <form action={formAction} className="flex flex-col gap-2 sm:items-end">
      <input type="hidden" name="findingId" value={findingId} />
      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor={`finding-status-${findingId}`} className="sr-only">
          Finding status
        </label>
        <Select
          id={`finding-status-${findingId}`}
          name="status"
          value={selectedStatus}
          onChange={(event) => setSelectedStatus(event.target.value)}
          className="mt-0 h-8 w-auto text-xs"
        >
          {findingStatuses.map((value) => (
            <option key={value} value={value}>
              {findingStatusLabels[value]}
            </option>
          ))}
        </Select>
        <label htmlFor={`finding-note-${findingId}`} className="sr-only">
          Triage reason
        </label>
        <Input
          id={`finding-note-${findingId}`}
          name="note"
          maxLength={500}
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="Reason (required to dismiss)"
          className="mt-0 h-8 w-56 text-xs"
        />
        <SubmitButton variant="secondary" size="sm" pendingLabel="Updating…">
          Update
        </SubmitButton>
      </div>
      <ReviewMessage state={state} />
    </form>
  );
}
