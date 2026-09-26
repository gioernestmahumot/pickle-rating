import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SignUpForm } from "@/components/auth-forms";
import { getSession } from "@/lib/session";

export const metadata: Metadata = { title: "Create your player profile" };

export default async function SignUpPage() {
  const { player } = await getSession();
  if (player) redirect("/");
  return (
    <div className="mx-auto max-w-lg">
      <h1 className="page-title">Join Pickle Rating</h1>
      <p className="mt-2 text-ink-2">Every player starts at 1500. Your rating moves with each confirmed match.</p>
      <div className="card mt-6"><SignUpForm /></div>
    </div>
  );
}
