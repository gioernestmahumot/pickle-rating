import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { FeedbackForm } from "@/components/feedback-form";
import { getSession } from "@/lib/session";
import { getContactUrl } from "@/lib/site";

export const metadata: Metadata = { title: "Send feedback" };

export default async function FeedbackPage() {
  const { player } = await getSession();
  if (!player) redirect("/login?next=/feedback");
  return (
    <div className="mx-auto max-w-lg">
      <Link href="/" className="link text-sm">← Back</Link>
      <h1 className="page-title mt-2">Send feedback</h1>
      <p className="mt-1 text-ink-2">Ideas, problems or a score that looks wrong. It goes straight to the Pickle Rating team.</p>
      <div className="card mt-6">
        <FeedbackForm firstName={player.display_name.split(" ")[0]} displayName={player.display_name} contactUrl={getContactUrl()} />
      </div>
    </div>
  );
}
