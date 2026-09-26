import type { Game } from "@/lib/types";

/**
 * Reads a score line such as "11-7, 9-11, 11-5" (commas, semicolons or spaces
 * between games). The database re-checks every rule; this only gives early,
 * friendly errors in forms.
 */
export function parseScoreLine(input: string): { games: Game[] } | { error: string } {
  // Tighten "15 - 13" to "15-13" first so spaces only ever separate games.
  const parts = input.trim().replace(/\s*([-–:])\s*/g, "$1").split(/[,;\s]+/).filter(Boolean);
  if (!parts.length) return { error: "Enter the score, e.g. 11-7, 9-11, 11-5." };
  const games: Game[] = [];
  for (const part of parts) {
    const match = /^(\d{1,2})\s*[-–:]\s*(\d{1,2})$/.exec(part);
    if (!match) return { error: `"${part}" is not a game score. Use the form 11-7.` };
    games.push({ team1: Number(match[1]), team2: Number(match[2]) });
  }
  return validateGames(games);
}

export function validateGames(games: Game[]): { games: Game[] } | { error: string } {
  if (games.length < 1 || games.length > 5) return { error: "Enter between 1 and 5 games." };
  let wins1 = 0;
  let wins2 = 0;
  for (const game of games) {
    if (![game.team1, game.team2].every((score) => Number.isInteger(score) && score >= 0 && score <= 99)) {
      return { error: "Scores must be whole numbers from 0 to 99." };
    }
    if (game.team1 === game.team2) return { error: "A game cannot end in a tie." };
    if (game.team1 > game.team2) wins1 += 1;
    else wins2 += 1;
  }
  if (wins1 === wins2) return { error: "Both teams won the same number of games. Add the deciding game." };
  return { games };
}
