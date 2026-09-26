import type { Game } from "@/lib/types";

// Everything is shown in Philippine time (UTC+8, no daylight saving).
const TIME_ZONE = "Asia/Manila";

const dateFormat = new Intl.DateTimeFormat("en-PH", { timeZone: TIME_ZONE, month: "short", day: "numeric", year: "numeric" });
const dateTimeFormat = new Intl.DateTimeFormat("en-PH", {
  timeZone: TIME_ZONE, month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit",
});

export function formatDate(value: string): string {
  // A bare date (YYYY-MM-DD) is a calendar day, not a moment: pin it to Manila noon.
  return dateFormat.format(new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T12:00:00+08:00` : value));
}

export function formatDateTime(value: string): string {
  return dateTimeFormat.format(new Date(value));
}

/** Current Manila time as a datetime-local input value (YYYY-MM-DDTHH:mm). */
export function manilaNowForInput(now = new Date()): string {
  return new Date(now.getTime() + 8 * 3_600_000).toISOString().slice(0, 16);
}

/** Today's date in Manila as YYYY-MM-DD. */
export function manilaToday(now = new Date()): string {
  return manilaNowForInput(now).slice(0, 10);
}

/** Reads a datetime-local value typed in Manila time as an ISO timestamp. */
export function manilaInputToIso(value: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null;
  const date = new Date(`${value}:00+08:00`);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export function formatGames(games: Game[]): string {
  return games.map((game) => `${game.team1}–${game.team2}`).join(", ");
}

export function winRate(wins: number, played: number): string {
  return played ? `${Math.round((wins / played) * 100)}%` : "–";
}

export function formatDelta(delta: number): string {
  return delta > 0 ? `+${delta}` : delta < 0 ? `−${Math.abs(delta)}` : "0";
}

export function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

/** ISO timestamp for `days` ago, for "older than" queries. */
export function daysAgoIso(days: number, now = new Date()): string {
  return new Date(now.getTime() - days * 86_400_000).toISOString();
}
