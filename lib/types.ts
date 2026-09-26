export type Format = "singles" | "doubles";
export type MatchStatus = "pending" | "confirmed" | "disputed" | "cancelled" | "voided";
export type TournamentStatus = "registration" | "in_progress" | "completed" | "cancelled";

export interface Player {
  id: string;
  display_name: string;
  region: string;
  city: string | null;
  singles_rating: number;
  doubles_rating: number;
  singles_played: number;
  doubles_played: number;
  singles_wins: number;
  doubles_wins: number;
  is_admin: boolean;
  created_at: string;
}

export type PlayerSummary = Pick<Player, "id" | "display_name" | "region" | "city">;

export interface Game {
  team1: number;
  team2: number;
}

export interface Club {
  id: string;
  name: string;
  region: string;
  city: string | null;
  description: string | null;
  created_by: string;
  created_at: string;
}

export interface Tournament {
  id: string;
  name: string;
  format: Format;
  club_id: string | null;
  region: string;
  city: string | null;
  venue: string | null;
  starts_on: string;
  description: string | null;
  max_entries: number;
  status: TournamentStatus;
  organizer_id: string;
  winner_entry_id: string | null;
  created_at: string;
}

export const FORMATS: Format[] = ["singles", "doubles"];

export function parseFormat(value: unknown): Format {
  return value === "doubles" ? "doubles" : "singles";
}

export function formatLabel(format: Format): string {
  return format === "singles" ? "Singles" : "Doubles";
}
