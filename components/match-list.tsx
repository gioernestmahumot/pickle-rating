import Link from "next/link";
import { formatDelta, formatDateTime, formatGames } from "@/lib/format";
import { team, teamOfPlayer, type MatchView } from "@/lib/matches";
import { formatLabel, type MatchStatus, type PlayerSummary } from "@/lib/types";

const STATUS_STYLES: Record<MatchStatus, string> = {
  pending: "bg-warn-tint text-warn ring-warn/30",
  confirmed: "bg-good-tint text-good ring-good/30",
  disputed: "bg-bad-tint text-bad ring-bad/30",
  cancelled: "bg-surface-2 text-ink-2 ring-line",
  voided: "bg-surface-2 text-ink-2 ring-line",
};

const STATUS_LABELS: Record<MatchStatus, string> = {
  pending: "Waiting for confirmation",
  confirmed: "Confirmed",
  disputed: "Disputed",
  cancelled: "Cancelled",
  voided: "Voided",
};

export function StatusBadge({ status }: { status: MatchStatus }) {
  return <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ${STATUS_STYLES[status]}`}>{STATUS_LABELS[status]}</span>;
}

function names(players: PlayerSummary[]) {
  return players.map((p) => p.display_name).join(" & ");
}

/**
 * Match rows. With `perspective`, each row reads from that player's side:
 * their team first, a W/L badge, and their rating change.
 */
export function MatchList({ matches, perspective, empty }: { matches: MatchView[]; perspective?: string; empty: string }) {
  if (!matches.length) return <p className="muted py-4">{empty}</p>;
  return (
    <ul className="divide-y divide-line">
      {matches.map((match) => {
        const mySide = perspective ? teamOfPlayer(match, perspective) : null;
        const first: 1 | 2 = mySide ?? 1;
        const second: 1 | 2 = first === 1 ? 2 : 1;
        const games = match.games.map((game) => (first === 1 ? game : { team1: game.team2, team2: game.team1 }));
        const won = mySide !== null && match.winner_team === mySide;
        const change = perspective ? match.rating_history.find((h) => h.player_id === perspective) : undefined;
        return (
          <li key={match.id}>
            <Link href={`/matches/${match.id}`} className="flex items-center gap-3 py-3 hover:bg-surface-2 sm:px-2">
              {mySide !== null && match.status === "confirmed" && (
                <span className={`grid size-8 shrink-0 place-items-center rounded-full text-sm font-bold ${won ? "bg-[#2f7d4f] text-white" : "bg-surface-2 text-ink-2"}`}>
                  {won ? "W" : "L"}
                </span>
              )}
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-ink">
                  {names(team(match, first))} <span className="font-normal text-ink-4">vs</span> {names(team(match, second))}
                </span>
                <span className="block truncate text-xs text-ink-3">
                  {formatLabel(match.format)} · {formatGames(games)} · {formatDateTime(match.played_at)}
                  {match.clubs && ` · ${match.clubs.name}`}
                  {match.tournaments && ` · ${match.tournaments.name}`}
                </span>
              </span>
              <span className="flex shrink-0 flex-col items-end gap-1">
                {match.status !== "confirmed" && <StatusBadge status={match.status} />}
                {change && (
                  <span className={`text-sm font-semibold tabular-nums ${change.rating_after >= change.rating_before ? "text-good" : "text-bad"}`}>
                    {formatDelta(change.rating_after - change.rating_before)}
                  </span>
                )}
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
