"use client";

import { useActionState } from "react";
import type { ActionState } from "@/app/actions";
import { FormMessage } from "@/components/form-message";

type Action = (state: ActionState, formData: FormData) => Promise<ActionState>;

/** A one-button form that runs a server action and shows its result inline. */
export function ActionButton({
  action,
  fields,
  label,
  pendingLabel,
  className = "btn-secondary",
  confirmMessage,
}: {
  action: Action;
  fields: Record<string, string>;
  label: string;
  pendingLabel?: string;
  className?: string;
  confirmMessage?: string;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  return (
    <form
      action={formAction}
      className="flex flex-col gap-2"
      onSubmit={(event) => {
        if (confirmMessage && !window.confirm(confirmMessage)) event.preventDefault();
      }}
    >
      {Object.entries(fields).map(([name, value]) => <input key={name} type="hidden" name={name} value={value} />)}
      <button type="submit" className={className} disabled={pending}>{pending ? pendingLabel ?? "Working…" : label}</button>
      <FormMessage state={state} />
    </form>
  );
}
