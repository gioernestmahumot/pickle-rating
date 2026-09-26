import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { joinClubAction, leaveClubAction, removeClubMemberAction } from "@/app/actions";
import { ActionButton } from "@/components/action-button";
import { isProvisional } from "@/lib/elo";
import { formatDate } from "@/lib/format";
import { regionName } from "@/lib/regions";
import { getSession } from "@/lib/session";
import { formatLabel, FORMATS, parseFormat, type Club, type PlayerSummary, type Tournament } from "@/lib/types";

export const metadata: Metadata = { title: "Club" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function ClubPage({ params, searchParams }: PageProps<"/clubs/[id]">) {
  const { id } = await params;
  const format = parseFormat((await searchParams).format);
  if (!UUID.test(id)) notFound();
  const { supabase, player } = await getSession();
  const { data: clubData } = await supabase.from("clubs").select("*").eq("id", id).maybeSingle();
  const club = clubData as Club | null;
  if (!club) notFound();

  const [members, ratings, tournaments, matchCount] = await Promise.all([
    supabase.from("club_members").select("player_id, role, joined_at, players(id, display_name, region, city)").eq("club_id", id).order("joined_at"),
    supabase.from("club_ratings").select("player_id, rating, played, wins, players(id, display_name, region, city, singles_rating, doubles_rating)")
      .eq("club_id", id).eq("format", format).gt("played", 0).order("rating", { ascending: false }).limit(100),
    supabase.from("tournaments").select("*").eq("club_id", id).in("status", ["registration", "in_progress"]).order("starts_on"),
    supabase.from("matches").select("id", { count: "exact", head: true }).eq("club_id", id).eq("status", "confirmed"),
  ]);
  const memberRows = (members.data ?? []) as unknown as { player_id: string; role: string; players: PlayerSummary }[];
  const ratingRows = (ratings.data ?? []) as unknown as {
    player_id: string; rating: number; played: number; wins: number;
    players: PlayerSummary & { singles_rating: number; doubles_rating: number };
  }[];
  const myRole = memberRows.find((m) => m.player_id === player?.id)?.role ?? null;
  const canManage = myRole === "owner" || myRole === "admin";

  return (
    <div className="space-y-6">
      <section className="-mx-4 -mt-6 space-y-3 bg-accent px-4 py-6 text-accent-ink md:mx-0 md:mt-0 md:rounded-2xl md:p-8">
        <Link href="/clubs" className="text-sm font-bold">← Clubs</Link>
        <p className="text-xs font-bold tracking-[0.1em] uppercase">Club · {[club.city, regionName(club.region)].filter(Boolean).join(", ")}</p>
        <h1 className="font-display text-3xl font-extrabold tracking-tight md:text-4xl">{club.name}</h1>
        {club.description && <p className="max-w-2xl leading-relaxed whitespace-pre-line">{club.description}</p>}
        <div className="flex flex-wrap items-center gap-3">
          {player && !myRole && <ActionButton action={joinClubAction} fields={{ club: club.id }} label="Join club" className="btn bg-brand text-brand-ink" />}
          {myRole && myRole !== "owner" && <ActionButton action={leaveClubAction} fields={{ club: club.id }} label="Leave club" className="btn border border-accent-ink/30" confirmMessage="Leave this club?" />}
          {!player && <Link href={`/login?next=/clubs/${club.id}`} className="btn bg-brand text-brand-ink">Sign in to join</Link>}
          <span className="text-sm font-semibold">{memberRows.length} members · {matchCount.count ?? 0} club matches</span>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
        <section className="overflow-hidden rounded-2xl border border-line bg-surface">
          <div className="flex items-center justify-between gap-3 px-5 pt-4">
            <h2 className="section-title">Club rankings</h2>
            <div className="flex gap-1 rounded-xl bg-surface-2 p-1 text-sm">
              {FORMATS.map((option) => (
                <Link key={option} href={`/clubs/${club.id}?format=${option}`} scroll={false}
                  className={`rounded-lg px-3 py-1.5 font-semibold ${format === option ? "bg-surface text-link" : "text-ink-2"}`}>{formatLabel(option)}</Link>
              ))}
            </div>
          </div>
          <p className="px-5 pt-1 pb-3 text-xs text-ink-3">Rated only from matches played inside this club. National rating shown for comparison.</p>
          {ratingRows.length === 0 ? <p className="muted border-t border-line px-5 py-6">No club {format} matches yet.</p> : (
            <ol>
              {ratingRows.map((row, index) => (
                <li key={row.player_id} className="border-t border-line">
                  <Link href={`/players/${row.player_id}`} className="flex items-center gap-3 px-5 py-3 hover:bg-surface-2">
                    <span className={`num w-7 text-lg ${index < 3 ? "text-link" : "text-ink-4"}`}>{index + 1}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-bold">{row.players.display_name}</span>
                      <span className="block text-xs text-ink-3">{row.wins}–{row.played - row.wins}</span>
                    </span>
                    <span className="text-right">
                      <span className="num block text-lg">{row.rating}{isProvisional(row.played) && <span className="ml-1 align-top text-xs text-ink-4">P</span>}</span>
                      <span className="block text-[11px] text-ink-3">national {row.players[`${format}_rating`]}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ol>
          )}
        </section>

        <aside className="space-y-5">
          {myRole && <Link href={`/matches/new?club=${club.id}`} className="btn-primary w-full">Record a club match</Link>}
          {tournaments.data && tournaments.data.length > 0 && (
            <section className="space-y-3 rounded-2xl bg-brand p-5 text-brand-ink">
              <p className="text-xs font-bold tracking-[0.1em] text-accent uppercase">Club tournaments</p>
              {(tournaments.data as Tournament[]).map((t) => (
                <Link key={t.id} href={`/tournaments/${t.id}`} className="block">
                  <span className="block font-display text-xl font-extrabold">{t.name}</span>
                  <span className="text-sm text-brand-ink-2">{formatDate(t.starts_on)} · {formatLabel(t.format)} · {t.status === "registration" ? "Registration open" : "In progress"}</span>
                </Link>
              ))}
            </section>
          )}
          {canManage && <Link href="/tournaments#create" className="link block">Create a club tournament →</Link>}
          <section className="card">
            <h2 className="section-title">Members</h2>
            <ul className="mt-2 divide-y divide-line">
              {memberRows.map((member) => (
                <li key={member.player_id} className="flex items-center gap-2 py-2">
                  <Link href={`/players/${member.player_id}`} className="min-w-0 flex-1 truncate font-semibold hover:underline">{member.players.display_name}</Link>
                  {member.role !== "member" && <span className="rounded-full bg-surface-2 px-2 py-0.5 text-xs font-bold text-ink-2 capitalize">{member.role}</span>}
                  {canManage && member.role === "member" && (
                    <ActionButton action={removeClubMemberAction} fields={{ club: club.id, player: member.player_id }} label="Remove"
                      className="text-sm font-semibold text-bad hover:underline" confirmMessage={`Remove ${member.players.display_name} from the club?`} />
                  )}
                </li>
              ))}
            </ul>
          </section>
        </aside>
      </div>
    </div>
  );
}
