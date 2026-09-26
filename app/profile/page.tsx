import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { signOutAction } from "@/app/actions";
import { ProfileForm } from "@/components/auth-forms";
import { getSession } from "@/lib/session";

export const metadata: Metadata = { title: "Edit profile" };

export default async function ProfilePage() {
  const { user, player } = await getSession();
  if (!user || !player) redirect("/login?next=/profile");
  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div>
        <Link href={`/players/${player.id}`} className="link text-sm">← Your profile</Link>
        <h1 className="page-title mt-2">Edit profile</h1>
        <p className="muted mt-1">Signed in as {user.email}</p>
      </div>
      <div className="card">
        <ProfileForm displayName={player.display_name} region={player.region} city={player.city ?? ""} />
      </div>
      <form action={signOutAction}>
        <button type="submit" className="btn-secondary">Sign out</button>
      </form>
    </div>
  );
}
