import type { Metadata } from "next";
import Link from "next/link";
import { MatchList } from "@/components/match-list";
import { daysAgoIso } from "@/lib/format";
import { MATCH_SELECT, type MatchView } from "@/lib/matches";
import { getSession } from "@/lib/session";

export const metadata: Metadata = { title: "Admin" };

export default async function AdminPage() {
  const { supabase, player } = await getSession();
  if (!player?.is_admin) {
    return (
      <div className="mx-auto max-w-lg text-center">
        <h1 className="page-title">Admins only</h1>
        <p className="mt-2 text-ink-2">This page is for Pickle Rating admins who settle disputed scores.</p>
        <Link href="/" className="link mt-4 inline-block">Back to rankings</Link>
      </div>
    );
  }
  const [{ data: disputed }, { data: stale }] = await Promise.all([
    supabase.from("matches").select(MATCH_SELECT).eq("status", "disputed").order("created_at", { ascending: true }).limit(100),
    supabase.from("matches").select(MATCH_SELECT).eq("status", "pending")
      .lt("created_at", daysAgoIso(14)).order("created_at").limit(50),
  ]);
  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Admin</h1>
        <p className="mt-1 text-ink-2">Open a match to confirm it or void it. Voiding a confirmed match recalculates ratings without it.</p>
      </div>
      <section className="card">
        <h2 className="section-title">Disputed matches</h2>
        <MatchList matches={(disputed ?? []) as unknown as MatchView[]} empty="No disputes." />
      </section>
      <section className="card">
        <h2 className="section-title">Pending for over 2 weeks</h2>
        <MatchList matches={(stale ?? []) as unknown as MatchView[]} empty="None." />
      </section>
    </div>
  );
}
