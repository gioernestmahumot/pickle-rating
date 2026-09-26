// The rating formula. The database (supabase/migrations, apply_match_rating)
// is the source of truth; this copy powers win-chance and preview numbers in
// the UI, and tests/db.test.mjs checks both give identical results.

export const STARTING_RATING = 1500;

/** New players move faster until they have 20 rated matches in a format. */
export function kFactor(played: number): number {
  return played < 20 ? 32 : 16;
}

/** Chance (0–1) that a side rated `rating` beats a side rated `opponent`. */
export function expectedScore(rating: number, opponent: number): number {
  return 1 / (1 + 10 ** ((opponent - rating) / 400));
}

/** A doubles team is rated by the average of both partners. */
export function teamRating(ratings: number[]): number {
  return ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length;
}

/** Postgres round(): halves round away from zero (Math.round rounds -0.5 up to 0). */
function roundHalfAwayFromZero(value: number): number {
  return Math.sign(value) * Math.round(Math.abs(value));
}

export interface RatedPlayer {
  rating: number;
  played: number;
}

/** New ratings for both teams after a match; mirrors apply_match_rating(). */
export function rateMatch(team1: RatedPlayer[], team2: RatedPlayer[], winnerTeam: 1 | 2): { team1: number[]; team2: number[] } {
  const expected1 = expectedScore(teamRating(team1.map((p) => p.rating)), teamRating(team2.map((p) => p.rating)));
  const next = (player: RatedPlayer, expected: number, won: boolean) =>
    player.rating + roundHalfAwayFromZero(kFactor(player.played) * ((won ? 1 : 0) - expected));
  return {
    team1: team1.map((player) => next(player, expected1, winnerTeam === 1)),
    team2: team2.map((player) => next(player, 1 - expected1, winnerTeam === 2)),
  };
}

/** Fewer than 5 rated matches: shown as provisional on leaderboards. */
export function isProvisional(played: number): boolean {
  return played < 5;
}
