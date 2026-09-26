"use client";

import Link from "next/link";
import { useActionState } from "react";
import { requestPasswordResetAction, setNewPasswordAction, type ActionState } from "@/app/actions";
import { FormMessage } from "@/components/form-message";

export function ForgotPasswordForm() {
  const [state, action, pending] = useActionState<ActionState, FormData>(requestPasswordResetAction, {});
  if (state.message) {
    return (
      <div className="space-y-3">
        <FormMessage state={state} />
        <Link href="/login" className="link">Back to sign in</Link>
      </div>
    );
  }
  return (
    <form action={action} className="space-y-4">
      <div>
        <label className="label" htmlFor="email">Email</label>
        <input id="email" name="email" type="email" className="input" autoComplete="email" required />
      </div>
      <FormMessage state={state} />
      <button type="submit" className="btn-primary w-full" disabled={pending}>{pending ? "Sending…" : "Email me a reset link"}</button>
      <p className="muted text-center"><Link href="/login" className="link">Back to sign in</Link></p>
    </form>
  );
}

export function NewPasswordForm() {
  const [state, action, pending] = useActionState<ActionState, FormData>(setNewPasswordAction, {});
  return (
    <form action={action} className="space-y-4">
      <div>
        <label className="label" htmlFor="password">New password</label>
        <input id="password" name="password" type="password" className="input" autoComplete="new-password" minLength={8} required />
      </div>
      <div>
        <label className="label" htmlFor="confirm">Type it again</label>
        <input id="confirm" name="confirm" type="password" className="input" autoComplete="new-password" minLength={8} required />
      </div>
      <FormMessage state={state} />
      <button type="submit" className="btn-primary w-full" disabled={pending}>{pending ? "Saving…" : "Save new password"}</button>
    </form>
  );
}
