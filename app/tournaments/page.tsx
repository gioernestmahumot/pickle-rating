import type { Metadata } from "next";
import Link from "next/link";
import { CreateTournamentForm } from "@/components/forms";
import { formatDate, manilaToday } from "@/lib/format";
import { regionName } from "@/lib/regions";
import { getSession } from "@/lib/session";
import { formatLabel, type Tournament } from "@/lib/types";

export const metadata: Metadata = { title: "Tournaments" };

const STATUS_LABEL: Record<Tournament["status"], string> = {
  registration: "Registration open", in_progress: "In progress", completed: "Completed", cancelled: "Cancelled",
};

export default async function TournamentsPage() {
  const { supabase, player } = await getSession();
  const [{ data: active }, { data: past }, managed] = await Promise.all([
    supabase.from("tournaments").select("*, clubs(name), tournament_entries!tournament_entries_tournament_id_fkey(count)").in("status", ["registration", "in_progress"]).order("starts_on").limit(100),
    supabase.from("tournaments").select("*, clubs(name), tournament_entries!tournament_entries_tournament_id_fkey(count)").eq("status", "completed").order("starts_on", { ascending: false }).limit(20),
    player ? supabase.from("club_members").select("clubs(id, name)").eq("player_id", player.id).in("role", ["owner", "admin"]) : Promise.resolve({ data: [] }),
  ]);
  const myClubs = ((managed.data ?? []) as unknown as { clubs: { id: string; name: string } | null }[]).flatMap((row) => (row.clubs ? [row.clubs] : []));
  type Row = Tournament & { clubs: { name: string } | null; tournament_entries: { count: number }[] };

  const list = (rows: Row[], empty: string) => rows.length === 0 ? <p className="muted">{empty}</p> : (
    <div className="grid gap-3 sm:grid-cols-2">
      {rows.map((t) => (
        <Link key={t.id} href={`/tournaments/${t.id}`} className="card block p-4 hover:border-line-strong">
          <p className="eyebrow">{formatDate(t.starts_on)} · {[t.city, regionName(t.region)].filter(Boolean).join(", ")}</p>
          <p className="mt-1 font-display text-xl font-extrabold">{t.name}</p>
          <p className="mt-1 text-sm text-ink-2">
            {formatLabel(t.format)} · {t.tournament_entries[0]?.count ?? 0} of {t.max_entries} {t.format === "doubles" ? "teams" : "players"}
            {t.clubs && ` · ${t.clubs.name}`}
          </p>
          <p className="mt-2 text-xs font-bold text-link">{STATUS_LABEL[t.status]}</p>
        </Link>
      ))}
    </div>
  );

  return (
    <div className="space-y-8">
      <div>
        <h1 className="page-title">Tournaments</h1>
        <p className="mt-1 text-ink-2">Single-elimination brackets, seeded by rating. Every bracket result counts toward ratings.</p>
      </div>
      <section className="space-y-3">
        <h2 className="section-title">Upcoming and live</h2>
        {list((active ?? []) as Row[], "No tournaments open right now.")}
      </section>
      <section className="space-y-3">
        <h2 className="section-title">Recently completed</h2>
        {list((past ?? []) as Row[], "No completed tournaments yet.")}
      </section>
      <section id="create" className="card max-w-3xl scroll-mt-24">
        <h2 className="section-title">Organize a tournament</h2>
        {player ? <div className="mt-3"><CreateTournamentForm clubs={myClubs} defaultRegion={player.region} today={manilaToday()} /></div> : (
          <p className="muted mt-2"><Link href="/login?next=/tournaments" className="link">Sign in</Link> to organize a tournament.</p>
        )}
      </section>
    </div>
  );
}
