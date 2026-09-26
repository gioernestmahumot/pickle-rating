"use client";

import Link from "next/link";
import { useActionState } from "react";
import { signInAction, signUpAction, updateProfileAction, type ActionState } from "@/app/actions";
import { FormMessage } from "@/components/form-message";
import { RegionSelect } from "@/components/region-select";

export function SignInForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(signInAction, {});
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="next" value={next} />
      <div>
        <label className="label" htmlFor="email">Email</label>
        <input id="email" name="email" type="email" className="input" autoComplete="email" required />
      </div>
      <div>
        <div className="flex items-baseline justify-between">
          <label className="label" htmlFor="password">Password</label>
          <Link href="/forgot-password" className="text-sm font-semibold text-link hover:underline">Forgot password?</Link>
        </div>
        <input id="password" name="password" type="password" className="input" autoComplete="current-password" required />
      </div>
      <FormMessage state={state} />
      <button type="submit" className="btn-primary w-full" disabled={pending}>{pending ? "Signing in…" : "Sign in"}</button>
      <p className="muted text-center">New here? <Link href="/signup" className="link">Create your player profile</Link></p>
    </form>
  );
}

export function SignUpForm() {
  const [state, action, pending] = useActionState<ActionState, FormData>(signUpAction, {});
  if (state.message) {
    return (
      <div className="space-y-3 text-center">
        <p className="font-semibold">Almost there</p>
        <FormMessage state={state} />
        <Link href="/login" className="link">Go to sign in</Link>
      </div>
    );
  }
  return (
    <form action={action} className="space-y-4">
      <div>
        <label className="label" htmlFor="display_name">Your name</label>
        <input id="display_name" name="display_name" className="input" autoComplete="name" minLength={2} maxLength={60} required />
        <p className="mt-1 text-xs text-ink-3">Shown on rankings. Use the name people know you by at the courts.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="region">Region</label>
          <RegionSelect />
        </div>
        <div>
          <label className="label" htmlFor="city">City or municipality</label>
          <input id="city" name="city" className="input" maxLength={60} placeholder="e.g. Makati" />
        </div>
      </div>
      <div>
        <label className="label" htmlFor="email">Email</label>
        <input id="email" name="email" type="email" className="input" autoComplete="email" required />
      </div>
      <div>
        <label className="label" htmlFor="password">Password</label>
        <input id="password" name="password" type="password" className="input" autoComplete="new-password" minLength={8} required />
        <p className="mt-1 text-xs text-ink-3">At least 8 characters.</p>
      </div>
      <FormMessage state={state} />
      <button type="submit" className="btn-primary w-full" disabled={pending}>{pending ? "Creating profile…" : "Create player profile"}</button>
      <p className="muted text-center">Already playing? <Link href="/login" className="link">Sign in</Link></p>
    </form>
  );
}

export function ProfileForm({ displayName, region, city }: { displayName: string; region: string; city: string }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(updateProfileAction, {});
  return (
    <form action={action} className="space-y-4">
      <div>
        <label className="label" htmlFor="display_name">Your name</label>
        <input id="display_name" name="display_name" className="input" defaultValue={displayName} minLength={2} maxLength={60} required />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="region">Region</label>
          <RegionSelect defaultValue={region} />
        </div>
        <div>
          <label className="label" htmlFor="city">City or municipality</label>
          <input id="city" name="city" className="input" defaultValue={city} maxLength={60} />
        </div>
      </div>
      <FormMessage state={state} />
      <button type="submit" className="btn-primary" disabled={pending}>{pending ? "Saving…" : "Save profile"}</button>
    </form>
  );
}
