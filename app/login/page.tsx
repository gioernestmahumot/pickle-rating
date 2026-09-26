import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SignInForm } from "@/components/auth-forms";
import { getSession } from "@/lib/session";
import { safeNextPath } from "@/lib/site";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const params = await searchParams;
  const next = safeNextPath(Array.isArray(params.next) ? params.next[0] : params.next);
  const { player } = await getSession();
  if (player) redirect(next);
  return (
    <div className="mx-auto max-w-md">
      <h1 className="page-title">Sign in</h1>
      <p className="mt-2 text-ink-2">Record matches, confirm scores and climb the rankings.</p>
      {params.error === "confirm" && (
        <p role="alert" className="mt-4 rounded-xl bg-bad-tint px-3 py-2 text-sm text-bad">That confirmation link has expired or was already used. Sign in, or sign up again.</p>
      )}
      <div className="card mt-6"><SignInForm next={next} /></div>
    </div>
  );
}
