import type { Metadata } from "next";
import Link from "next/link";
import { NewPasswordForm } from "@/components/password-forms";
import { getSession } from "@/lib/session";

export const metadata: Metadata = { title: "Choose a new password" };

/** Reached from the reset email: /auth/callback signs the player in, then sends them here. */
export default async function ResetPasswordPage() {
  const { user } = await getSession();
  return (
    <div className="mx-auto max-w-md">
      <h1 className="page-title">Choose a new password</h1>
      {user ? (
        <div className="card mt-6"><NewPasswordForm /></div>
      ) : (
        <p className="mt-3 text-ink-2">
          This reset link has expired or was already used. <Link href="/forgot-password" className="link">Request a new one</Link>.
        </p>
      )}
    </div>
  );
}
