"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { sendFeedbackAction, type ActionState } from "@/app/actions";
import { FormMessage } from "@/components/form-message";
import { FEEDBACK_KINDS } from "@/lib/feedback";


interface Props {
  firstName: string;
  displayName: string;
  contactUrl: string | null;
}

/** "Send another" remounts the form, which also clears the finished action's state. */
export function FeedbackForm(props: Props) {
  const [round, setRound] = useState(0);
  return <FeedbackFormRound key={round} {...props} onSendAnother={() => setRound((n) => n + 1)} />;
}

function FeedbackFormRound({ firstName, displayName, contactUrl, onSendAnother }: Props & { onSendAnother: () => void }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(sendFeedbackAction, {});
  const [kind, setKind] = useState<string>("suggestion");
  const [message, setMessage] = useState("");
  // The action answers "sent" once saved; the typed kind and message are still in state.
  if (state.message === "sent") {
    const label = FEEDBACK_KINDS.find((k) => k.value === kind)?.label ?? "Feedback";
    return (
      <div className="flex flex-col items-center gap-4 py-6 text-center">
        <div className="grid size-18 place-items-center rounded-full bg-good-tint">
          <svg className="size-9 text-good" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12.5 10 17l9-10" /></svg>
        </div>
        <h1 className="page-title">Thanks, {firstName}!</h1>
        <p className="max-w-sm text-ink-2">
          The Pickle Rating team will read your message.
          {contactUrl && <> We may reply through our <a href={contactUrl} className="link" target="_blank" rel="noreferrer">Facebook page</a> if we need more details.</>}
        </p>
        <div className="card w-full max-w-md p-4 text-left">
          <p className="eyebrow">{label}</p>
          <p className="mt-1 whitespace-pre-line">{message}</p>
        </div>
        <div className="flex w-full max-w-md flex-col gap-2">
          <Link href="/" className="btn w-full bg-brand text-brand-ink">Back to rankings</Link>
          <button type="button" className="btn-secondary w-full" onClick={onSendAnother}>Send another</button>
        </div>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-5">
      <fieldset className="space-y-2">
        <legend className="label">What is it about?</legend>
        {FEEDBACK_KINDS.map((option) => (
          <label key={option.value} className={`flex cursor-pointer items-center gap-3 rounded-2xl px-4 py-3 ${kind === option.value ? "border-2 border-link bg-tint" : "border border-line-strong bg-surface"}`}>
            <input type="radio" name="kind" value={option.value} checked={kind === option.value} onChange={() => setKind(option.value)} className="size-[18px] accent-[var(--link)]" />
            <span>
              <span className="block font-bold">{option.label}</span>
              <span className="block text-xs text-ink-3">{option.hint}</span>
            </span>
          </label>
        ))}
      </fieldset>
      <div>
        <label className="label" htmlFor="message">Your message</label>
        <textarea
          id="message"
          name="message"
          className="input min-h-36 py-3"
          maxLength={1000}
          required
          placeholder="Tell us what you'd like, or what happened"
          value={message}
          onChange={(event) => setMessage(event.target.value)}
        />
        <p className="mt-1 text-right text-xs text-ink-4">{message.length} / 1000</p>
      </div>
      <p className="text-sm text-ink-3">Sent as <strong className="text-ink">{displayName}</strong>, so we can look at your matches if needed. Only the team sees it.</p>
      <FormMessage state={state.message === "sent" ? {} : state} />
      <button type="submit" className="btn-primary w-full" disabled={pending}>{pending ? "Sending…" : "Send feedback"}</button>
    </form>
  );
}
