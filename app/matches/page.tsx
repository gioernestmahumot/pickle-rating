import type { Metadata } from "next";
import Link from "next/link";
import { MatchList } from "@/components/match-list";
import { getMatchesAwaitingPlayer, getPlayerMatches } from "@/lib/matches";
import { getSession } from "@/lib/session";

export const metadata: Metadata = { title: "Matches" };

export default async function MatchesPage() {
  const { supabase, player } = await getSession();
  if (!player) {
    return (
      <div className="mx-auto max-w-lg space-y-4 text-center">
        <h1 className="page-title">Your matches</h1>
        <p className="text-ink-2">Sign in to record matches and confirm the scores your opponents enter.</p>
        <div className="flex justify-center gap-2">
          <Link href="/login?next=/matches" className="btn-secondary">Sign in</Link>
          <Link href="/signup" className="btn-primary">Create profile</Link>
        </div>
      </div>
    );
  }
  const [waiting, mine] = await Promise.all([getMatchesAwaitingPlayer(supabase, player.id), getPlayerMatches(supabase, player.id, 50)]);
  const waitingIds = new Set(waiting.map((m) => m.id));
  const pendingOthers = mine.filter((m) => m.status === "pending" && !waitingIds.has(m.id));
  const rest = mine.filter((m) => m.status !== "pending");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="page-title">Your matches</h1>
          <p className="mt-1 text-ink-2">Confirm scores, follow up on pending ones, and see your history.</p>
        </div>
        <Link href="/matches/new" className="btn-primary">Record a match</Link>
      </div>
      <section className="card">
        <h2 className="section-title">Needs your confirmation</h2>
        <MatchList matches={waiting} perspective={player.id} empty="Nothing to confirm right now." />
      </section>
      <section className="card">
        <h2 className="section-title">Waiting for your opponents</h2>
        <MatchList matches={pendingOthers} perspective={player.id} empty="No pending matches." />
      </section>
      <section className="card">
        <h2 className="section-title">History</h2>
        <MatchList matches={rest} perspective={player.id} empty="No matches yet. Record your first one!" />
      </section>
      {player.is_admin && <Link href="/admin" className="link">Admin: review disputed matches →</Link>}
    </div>
  );
}
