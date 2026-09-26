import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { adminResolveMatchAction, cancelMatchAction, respondToMatchAction } from "@/app/actions";
import { ActionButton } from "@/components/action-button";
import { StatusBadge } from "@/components/match-list";
import { QrCode } from "@/components/qr-code";
import { expectedScore, rateMatch, teamRating } from "@/lib/elo";
import { formatDateTime, formatDelta, formatPercent } from "@/lib/format";
import { canRespond, getMatch, team, teamOfPlayer } from "@/lib/matches";
import { getSession } from "@/lib/session";
import { getSiteOrigin } from "@/lib/site";
import { formatLabel, type Player } from "@/lib/types";

export const metadata: Metadata = { title: "Match" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function MatchPage({ params, searchParams }: PageProps<"/matches/[id]">) {
  const { id } = await params;
  const recorded = (await searchParams).recorded === "1";
  if (!UUID.test(id)) notFound();
  const { supabase, player: me } = await getSession();
  const match = await getMatch(supabase, id);
  if (!match) notFound();

  const team1 = team(match, 1);
  const team2 = team(match, 2);
  const teamName = (players: { display_name: string }[]) => players.map((p) => p.display_name.split(" ").slice(-1)[0]).join(" & ");
  const fullNames = (players: { display_name: string }[]) => players.map((p) => p.display_name).join(" & ");
  const recorder = match.match_players.find((p) => p.player_id === match.created_by)?.players;
  const myTeam = me ? teamOfPlayer(match, me.id) : null;
  const recorderTeam = teamOfPlayer(match, match.created_by);

  // Ratings before the match: from history once confirmed, else current ratings (a preview).
  const ratingKey = `${match.format}_rating` as const;
  const playedKey = `${match.format}_played` as const;
  let before = new Map<string, { rating: number; played: number }>();
  if (match.status === "confirmed" && match.rating_history.length) {
    before = new Map(match.rating_history.map((h) => [h.player_id, { rating: h.rating_before, played: 0 }]));
  } else {
    const { data } = await supabase.from("players").select(`id, ${ratingKey}, ${playedKey}`).in("id", match.match_players.map((p) => p.player_id));
    before = new Map(((data ?? []) as unknown as Player[]).map((p) => [p.id, { rating: p[ratingKey], played: p[playedKey] }]));
  }
  const ratingOf = (pid: string) => before.get(pid)?.rating ?? 1500;
  const chance1 = expectedScore(teamRating(team1.map((p) => ratingOf(p.id))), teamRating(team2.map((p) => ratingOf(p.id))));
  const favored = chance1 >= 0.5 ? { names: teamName(team1), chance: chance1 } : { names: teamName(team2), chance: 1 - chance1 };

  const changes = new Map<string, number>();
  if (match.status === "confirmed") {
    match.rating_history.forEach((h) => changes.set(h.player_id, h.rating_after - h.rating_before));
  } else if (match.status === "pending" || match.status === "disputed") {
    const preview = rateMatch(
      team1.map((p) => before.get(p.id) ?? { rating: 1500, played: 0 }),
      team2.map((p) => before.get(p.id) ?? { rating: 1500, played: 0 }),
      match.winner_team,
    );
    team1.forEach((p, i) => changes.set(p.id, preview.team1[i] - ratingOf(p.id)));
    team2.forEach((p, i) => changes.set(p.id, preview.team2[i] - ratingOf(p.id)));
  }
  const clubChanges = new Map(match.rating_history.filter((h) => h.club_rating_after !== null).map((h) => [h.player_id, h.club_rating_after! - h.club_rating_before!]));

  const iCanRespond = canRespond(match, me?.id);
  const iRecorded = me?.id === match.created_by;
  const showQr = match.status === "pending" && myTeam !== null && myTeam === recorderTeam;

  const scoreRow = (side: 1 | 2, players: typeof team1) => {
    const won = match.winner_team === side;
    return (
      <div className={`grid grid-cols-[minmax(0,1fr)_repeat(var(--games),44px)] items-center gap-1 px-4 py-3.5 ${won ? "bg-good-tint" : ""}`} style={{ "--games": match.games.length } as React.CSSProperties}>
        <span className="min-w-0">
          <span className="block truncate font-extrabold">{players.map((p, i) => (
            <span key={p.id}>{i > 0 && " & "}<Link href={`/players/${p.id}`} className="hover:underline">{p.display_name}</Link></span>
          ))}</span>
          {won && <span className="text-xs font-bold text-good">Winner</span>}
        </span>
        {match.games.map((game, i) => {
          const mine = side === 1 ? game.team1 : game.team2;
          const theirs = side === 1 ? game.team2 : game.team1;
          return <span key={i} className={`num text-center text-2xl ${mine > theirs ? "" : "font-semibold text-ink-4"}`}>{mine}</span>;
        })}
      </div>
    );
  };

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div className="flex items-center justify-between gap-3">
        <Link href="/matches" className="link text-sm">← Matches</Link>
        <StatusBadge status={match.status} />
      </div>
      {recorded && match.status === "pending" && (
        <p role="status" className="rounded-xl bg-good-tint px-4 py-3 text-sm text-good">
          Match recorded. It counts once someone on the other team confirms: send them this page, or let them scan the code below.
        </p>
      )}
      <div>
        <p className="eyebrow">
          {formatLabel(match.format)}
          {match.clubs && <> · <Link href={`/clubs/${match.clubs.id}`} className="hover:underline">{match.clubs.name}</Link></>}
          {match.tournaments && <> · <Link href={`/tournaments/${match.tournaments.id}`} className="hover:underline">{match.tournaments.name}</Link></>}
        </p>
        <h1 className="mt-1 font-display text-2xl font-extrabold tracking-tight">{formatDateTime(match.played_at)}</h1>
        <p className="text-sm text-ink-2">{[match.location, recorder && `recorded by ${recorder.display_name}`].filter(Boolean).join(" · ")}</p>
      </div>

      <section className="overflow-hidden rounded-2xl border border-line bg-surface">
        {scoreRow(1, team1)}
        <div className="border-t border-line" />
        {scoreRow(2, team2)}
      </section>
      {match.notes && <p className="rounded-xl bg-surface-2 px-4 py-3 text-sm text-ink-2">{match.notes}</p>}

      {changes.size > 0 && (
        <section className="card space-y-3">
          <h2 className="section-title">{match.status === "confirmed" ? "Rating changes" : "If confirmed"}</h2>
          <p className="text-sm text-ink-2">Win chance before the match: {favored.names} {formatPercent(favored.chance)}</p>
          <div className="grid grid-cols-2 gap-2">
            {[...team1, ...team2].map((p) => {
              const delta = changes.get(p.id) ?? 0;
              const club = clubChanges.get(p.id);
              return (
                <div key={p.id} className={`flex items-center justify-between rounded-xl px-3 py-2.5 text-sm ${delta >= 0 ? "bg-good-tint" : "bg-bad-tint"}`}>
                  <span className="truncate">{p.display_name.split(" ").slice(-1)[0]}</span>
                  <span className="text-right">
                    <strong className={delta >= 0 ? "text-good" : "text-bad"}>{formatDelta(delta)}</strong>
                    {club !== undefined && <span className="block text-[11px] text-ink-3">club {formatDelta(club)}</span>}
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {iCanRespond && (
        <section className="space-y-3 rounded-2xl bg-brand p-5 text-brand-ink">
          <p className="leading-relaxed">{me!.display_name.split(" ")[0]}, is this score right? Your rating only changes once you confirm.</p>
          <ActionButton action={respondToMatchAction} fields={{ match: match.id, decision: "confirm" }} label="Confirm score" pendingLabel="Confirming…" className="btn-accent w-full" />
          <ActionButton action={respondToMatchAction} fields={{ match: match.id, decision: "dispute" }} label="Dispute" pendingLabel="Sending…"
            className="btn w-full border border-brand-ink-2/40 text-brand-ink" confirmMessage="Dispute this score? An admin will review it and the match won't count until then." />
        </section>
      )}

      {showQr && (
        <section className="card flex flex-col items-center gap-3 text-center">
          <h2 className="section-title">Confirm at the court</h2>
          <p className="muted max-w-sm">Show this to {fullNames(recorderTeam === 1 ? team2 : team1)}. They scan it with their phone camera to open this page and confirm.</p>
          <QrCode url={`${await getSiteOrigin()}/matches/${match.id}`} label="Scan to confirm this match" />
        </section>
      )}

      {iRecorded && match.status === "pending" && (
        <ActionButton action={cancelMatchAction} fields={{ match: match.id }} label="Cancel this match" className="btn-danger" confirmMessage="Cancel this match? It will not count toward anyone's rating." />
      )}

      {me?.is_admin && !match.tournament_id && ["pending", "disputed", "confirmed"].includes(match.status) && (
        <section className="card space-y-3">
          <h2 className="section-title">Admin</h2>
          <p className="muted">Confirming counts the match now. Voiding a confirmed match recalculates everyone&apos;s {match.format} ratings without it.</p>
          <div className="flex flex-wrap gap-2">
            {match.status !== "confirmed" && <ActionButton action={adminResolveMatchAction} fields={{ match: match.id, decision: "confirm" }} label="Confirm as admin" className="btn-primary" />}
            <ActionButton action={adminResolveMatchAction} fields={{ match: match.id, decision: "void" }} label="Void match" className="btn-danger" confirmMessage="Void this match?" />
          </div>
        </section>
      )}
    </div>
  );
}
