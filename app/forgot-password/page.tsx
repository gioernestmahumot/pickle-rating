import type { Metadata } from "next";
import { ForgotPasswordForm } from "@/components/password-forms";

export const metadata: Metadata = { title: "Forgot password" };

export default function ForgotPasswordPage() {
  return (
    <div className="mx-auto max-w-md">
      <h1 className="page-title">Forgot your password?</h1>
      <p className="mt-2 text-ink-2">Enter the email you signed up with and we&apos;ll send a link to choose a new one.</p>
      <div className="card mt-6"><ForgotPasswordForm /></div>
    </div>
  );
}
