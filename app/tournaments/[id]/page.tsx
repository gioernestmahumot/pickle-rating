import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cancelTournamentAction, registerForTournamentAction, startTournamentAction, withdrawFromTournamentAction } from "@/app/actions";
import { ActionButton } from "@/components/action-button";
import { BracketResultForm, DoublesRegisterForm } from "@/components/forms";
import { formatDate } from "@/lib/format";
import { regionName } from "@/lib/regions";
import { getSession } from "@/lib/session";
import { formatLabel, type Game, type Tournament } from "@/lib/types";

export const metadata: Metadata = { title: "Tournament" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface Named { id: string; display_name: string }
interface Entry { id: string; seed: number | null; player1_id: string; player2_id: string | null; p1: Named; p2: Named | null }
interface Slot {
  id: string; round: number; position: number; entry1_id: string | null; entry2_id: string | null; winner_entry_id: string | null;
  matches: { id: string; games: Game[]; winner_team: 1 | 2 } | null;
}

function roundName(round: number, rounds: number) {
  const fromEnd = rounds - round;
  return fromEnd === 0 ? "Final" : fromEnd === 1 ? "Semifinals" : fromEnd === 2 ? "Quarterfinals" : `Round ${round}`;
}

export default async function TournamentPage({ params }: PageProps<"/tournaments/[id]">) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const { supabase, player } = await getSession();
  const { data } = await supabase.from("tournaments").select("*, clubs(id, name), organizer:players!tournaments_organizer_id_fkey(id, display_name)").eq("id", id).maybeSingle();
  const tournament = data as (Tournament & { clubs: { id: string; name: string } | null; organizer: Named }) | null;
  if (!tournament) notFound();

  const [{ data: entryData }, { data: slotData }] = await Promise.all([
    supabase.from("tournament_entries")
      .select("id, seed, player1_id, player2_id, p1:players!tournament_entries_player1_id_fkey(id, display_name), p2:players!tournament_entries_player2_id_fkey(id, display_name)")
      .eq("tournament_id", id).order("seed", { ascending: true, nullsFirst: false }).order("created_at"),
    supabase.from("bracket_matches").select("id, round, position, entry1_id, entry2_id, winner_entry_id, matches(id, games, winner_team)")
      .eq("tournament_id", id).order("round").order("position"),
  ]);
  const entries = (entryData ?? []) as unknown as Entry[];
  const slots = (slotData ?? []) as unknown as Slot[];
  const byId = new Map(entries.map((e) => [e.id, e]));
  const label = (entry: Entry | undefined) => entry ? [entry.p1, entry.p2].filter(Boolean).map((p) => p!.display_name).join(" & ") : "";
  const rounds = slots.reduce((max, s) => Math.max(max, s.round), 0);
  const isOrganizer = player?.id === tournament.organizer_id;
  const myEntry = player ? entries.find((e) => e.player1_id === player.id || e.player2_id === player.id) : undefined;
  const winner = tournament.winner_entry_id ? byId.get(tournament.winner_entry_id) : undefined;
  const unit = tournament.format === "doubles" ? "teams" : "players";

  const side = (slot: Slot, which: 1 | 2) => {
    const entryId = which === 1 ? slot.entry1_id : slot.entry2_id;
    const entry = entryId ? byId.get(entryId) : undefined;
    const decided = slot.winner_entry_id !== null;
    const won = decided && slot.winner_entry_id === entryId;
    // A round-1 slot with no second entry is a bye; later empty slots wait for a winner.
    const empty = slot.round === 1 ? "Bye" : "Winner of previous match";
    const scores = slot.matches?.games.map((g) => (which === 1 ? g.team1 : g.team2)) ?? [];
    return (
      <div className={`flex min-h-10 items-center gap-2 px-3 text-sm ${decided && !won ? "text-ink-4" : ""}`}>
        <span className="w-5 text-xs text-ink-3">{entry?.seed ?? ""}</span>
        <span className={`min-w-0 flex-1 truncate ${won ? "font-bold" : entry ? "font-semibold" : "text-ink-4"}`}>{entry ? label(entry) : empty}</span>
        {scores.length > 0 && <span className="tabular-nums">{scores.join(" ")}</span>}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <Link href="/tournaments" className="link text-sm">← Tournaments</Link>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
            <span className="rounded-full bg-good-tint px-3 py-1 font-bold text-good">
              {{ registration: "Registration open", in_progress: "In progress", completed: "Completed", cancelled: "Cancelled" }[tournament.status]}
            </span>
            <span className="text-ink-2">{formatLabel(tournament.format)} · {entries.length} of {tournament.max_entries} {unit} · seeded by rating</span>
          </div>
          <h1 className="page-title mt-2">{tournament.name}</h1>
          <p className="mt-1 text-ink-2">
            {formatDate(tournament.starts_on)} · {[tournament.venue, tournament.city, regionName(tournament.region)].filter(Boolean).join(", ")}
            {tournament.clubs && <> · <Link href={`/clubs/${tournament.clubs.id}`} className="link">{tournament.clubs.name}</Link> members</>}
          </p>
          <p className="muted mt-1">Organized by <Link href={`/players/${tournament.organizer.id}`} className="link">{tournament.organizer.display_name}</Link></p>
        </div>
        {isOrganizer && (tournament.status === "registration" || tournament.status === "in_progress") && (
          <div className="flex flex-wrap gap-2">
            {tournament.status === "registration" && (
              <ActionButton action={startTournamentAction} fields={{ tournament: tournament.id }} label="Close registration & build bracket" className="btn-primary"
                confirmMessage={`Start with ${entries.length} ${unit}? Registration closes and seeds are set by rating.`} />
            )}
            <ActionButton action={cancelTournamentAction} fields={{ tournament: tournament.id }} label="Cancel tournament" className="btn-danger" confirmMessage="Cancel this tournament?" />
          </div>
        )}
      </div>
      {tournament.description && <p className="max-w-3xl rounded-2xl bg-surface-2 px-5 py-4 whitespace-pre-line text-ink-2">{tournament.description}</p>}

      {tournament.status === "registration" && (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
          <section className="card">
            <h2 className="section-title">Registered {unit}</h2>
            {entries.length === 0 ? <p className="muted mt-2">No one has registered yet.</p> : (
              <ol className="mt-2 list-decimal space-y-1.5 pl-5">
                {entries.map((entry) => <li key={entry.id} className="font-semibold">{label(entry)}</li>)}
              </ol>
            )}
          </section>
          <aside className="card space-y-3">
            {!player ? (
              <p className="muted"><Link href={`/login?next=/tournaments/${tournament.id}`} className="link">Sign in</Link> to register.</p>
            ) : myEntry ? (
              <>
                <p className="font-semibold">You&apos;re registered{myEntry.p2 ? ` with ${myEntry.player1_id === player.id ? myEntry.p2.display_name : myEntry.p1.display_name}` : ""}.</p>
                <ActionButton action={withdrawFromTournamentAction} fields={{ tournament: tournament.id }} label="Withdraw" className="btn-danger" confirmMessage="Withdraw from this tournament?" />
              </>
            ) : entries.length >= tournament.max_entries ? (
              <p className="font-semibold">This tournament is full.</p>
            ) : tournament.format === "doubles" ? (
              <DoublesRegisterForm tournamentId={tournament.id} me={player.id} />
            ) : (
              <ActionButton action={registerForTournamentAction} fields={{ tournament: tournament.id }} label="Register" className="btn-accent w-full" />
            )}
          </aside>
        </div>
      )}

      {slots.length > 0 && (
        <section className="overflow-x-auto pb-2">
          <div className="grid min-w-max auto-cols-[260px] grid-flow-col gap-6">
            {Array.from({ length: rounds }, (_, i) => i + 1).map((round) => (
              <div key={round} className="flex flex-col gap-3">
                <h2 className="text-xs font-bold tracking-wide text-ink-3 uppercase">{roundName(round, rounds)}</h2>
                <div className="flex flex-1 flex-col justify-around gap-3">
                  {slots.filter((s) => s.round === round).map((slot) => {
                    const ready = !slot.winner_entry_id && slot.entry1_id && slot.entry2_id;
                    return (
                      <div key={slot.id} className={`overflow-hidden rounded-xl border bg-surface ${ready && isOrganizer && tournament.status === "in_progress" ? "border-2 border-link" : "border-line"}`}>
                        {side(slot, 1)}
                        <div className="border-t border-line" />
                        {side(slot, 2)}
                        {slot.matches && <Link href={`/matches/${slot.matches.id}`} className="block border-t border-line px-3 py-1.5 text-xs font-semibold text-link">Match details</Link>}
                        {ready && isOrganizer && tournament.status === "in_progress" && <BracketResultForm bracketId={slot.id} />}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
            <div className="flex flex-col gap-3">
              <h2 className="text-xs font-bold tracking-wide text-ink-3 uppercase">Champion</h2>
              <div className="flex flex-1 flex-col justify-around">
                <div className="rounded-2xl bg-brand p-5 text-center text-brand-ink">
                  <svg className="mx-auto size-10 text-accent" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                    <path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4zM7 6H4a3 3 0 0 0 3 3M17 6h3a3 3 0 0 1-3 3" />
                  </svg>
                  <p className="mt-2 font-display text-xl font-extrabold">{winner ? label(winner) : "To be decided"}</p>
                  <p className="mt-1 text-sm text-brand-ink-2">Bracket results count toward national ratings.</p>
                </div>
              </div>
            </div>
          </div>
          {isOrganizer && tournament.status === "in_progress" && <p className="muted mt-3">Enter each score with the top side first, e.g. 11-7, 9-11, 11-5. Results count right away and winners move on.</p>}
        </section>
      )}
    </div>
  );
}
