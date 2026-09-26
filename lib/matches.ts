import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Format, Game, MatchStatus, PlayerSummary } from "@/lib/types";

export interface MatchParticipant {
  player_id: string;
  team: 1 | 2;
  responded_at: string | null;
  players: PlayerSummary;
}

export interface RatingChange {
  player_id: string;
  rating_before: number;
  rating_after: number;
  club_rating_before: number | null;
  club_rating_after: number | null;
}

export interface MatchView {
  id: string;
  format: Format;
  played_at: string;
  games: Game[];
  winner_team: 1 | 2;
  status: MatchStatus;
  created_by: string;
  club_id: string | null;
  tournament_id: string | null;
  location: string | null;
  notes: string | null;
  confirmed_at: string | null;
  created_at: string;
  match_players: MatchParticipant[];
  clubs: { id: string; name: string } | null;
  tournaments: { id: string; name: string } | null;
  rating_history: RatingChange[];
}

export const MATCH_SELECT =
  "id, format, played_at, games, winner_team, status, created_by, club_id, tournament_id, location, notes, confirmed_at, created_at, " +
  "match_players(player_id, team, responded_at, players(id, display_name, region, city)), clubs(id, name), tournaments(id, name), " +
  "rating_history(player_id, rating_before, rating_after, club_rating_before, club_rating_after)";

export function team(match: MatchView, side: 1 | 2): PlayerSummary[] {
  return match.match_players.filter((p) => p.team === side).map((p) => p.players);
}

export function teamOfPlayer(match: MatchView, playerId: string): 1 | 2 | null {
  return match.match_players.find((p) => p.player_id === playerId)?.team ?? null;
}

/** Someone on the other team from the recorder can confirm or dispute. */
export function canRespond(match: MatchView, playerId: string | undefined): boolean {
  if (!playerId || match.status !== "pending") return false;
  const mine = teamOfPlayer(match, playerId);
  return mine !== null && mine !== teamOfPlayer(match, match.created_by);
}

export async function getMatch(supabase: SupabaseClient, id: string): Promise<MatchView | null> {
  const { data } = await supabase.from("matches").select(MATCH_SELECT).eq("id", id).maybeSingle();
  return data as MatchView | null;
}

/** A player's matches, newest first. Two steps keeps the query simple and indexed. */
export async function getPlayerMatches(supabase: SupabaseClient, playerId: string, limit = 30): Promise<MatchView[]> {
  const { data: rows } = await supabase.from("match_players").select("match_id").eq("player_id", playerId).limit(500);
  const ids = (rows ?? []).map((row) => row.match_id as string);
  if (!ids.length) return [];
  const { data } = await supabase.from("matches").select(MATCH_SELECT).in("id", ids)
    .order("played_at", { ascending: false }).limit(limit);
  return (data ?? []) as unknown as MatchView[];
}

export async function getRecentConfirmedMatches(supabase: SupabaseClient, limit = 8): Promise<MatchView[]> {
  const { data } = await supabase.from("matches").select(MATCH_SELECT).eq("status", "confirmed")
    .order("confirmed_at", { ascending: false }).limit(limit);
  return (data ?? []) as unknown as MatchView[];
}

/** Pending matches where the player is on the other team from the recorder. */
export async function getMatchesAwaitingPlayer(supabase: SupabaseClient, playerId: string): Promise<MatchView[]> {
  const { data: rows } = await supabase.from("match_players").select("match_id")
    .eq("player_id", playerId).is("responded_at", null).limit(200);
  const ids = (rows ?? []).map((row) => row.match_id as string);
  if (!ids.length) return [];
  const { data } = await supabase.from("matches").select(MATCH_SELECT).in("id", ids).eq("status", "pending")
    .order("played_at", { ascending: false });
  return ((data ?? []) as unknown as MatchView[]).filter((match) => canRespond(match, playerId));
}
