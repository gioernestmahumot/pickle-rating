"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { manilaInputToIso } from "@/lib/format";
import { parseScoreLine, validateGames } from "@/lib/games";
import { isRegionCode } from "@/lib/regions";
import { getSiteOrigin, safeNextPath } from "@/lib/site";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Game } from "@/lib/types";

export interface ActionState {
  error?: string;
  message?: string;
}

const text = (formData: FormData, key: string) => {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const optionalId = (formData: FormData, key: string) => {
  const value = text(formData, key);
  return UUID.test(value) ? value : null;
};

/** Calls a database function; its `raise exception` messages are already written for players. */
async function callRpc(fn: string, args: Record<string, unknown>): Promise<{ data: unknown; error: string | null }> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc(fn, args);
  if (!error) return { data, error: null };
  if (error.code === "PGRST202") return { data: null, error: "The database is missing its functions. Apply the Supabase migrations." };
  if (error.message.includes("JWT") || (error.code === "42501" && /Sign in/.test(error.message))) {
    return { data: null, error: "Your session expired. Sign in again." };
  }
  return { data: null, error: error.message };
}

function refresh() {
  revalidatePath("/", "layout");
}

// ---------------------------------------------------------------------------
// Accounts
// ---------------------------------------------------------------------------

export async function signUpAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  const displayName = text(formData, "display_name");
  const region = text(formData, "region");
  const city = text(formData, "city");
  const email = text(formData, "email").toLowerCase();
  const password = typeof formData.get("password") === "string" ? String(formData.get("password")) : "";
  if (displayName.length < 2 || displayName.length > 60) return { error: "Enter your name (2–60 characters)." };
  if (!isRegionCode(region)) return { error: "Choose your region." };
  if (city.length > 60) return { error: "City names are up to 60 characters." };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "Enter a valid email address." };
  if (password.length < 8) return { error: "Use a password of at least 8 characters." };

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { display_name: displayName, region, city },
      emailRedirectTo: `${await getSiteOrigin()}/auth/callback`,
    },
  });
  if (error) {
    if (/already registered/i.test(error.message)) return { error: "An account with this email already exists. Sign in instead." };
    if (/rate limit/i.test(error.message)) return { error: "Too many sign-ups right now. Please try again in a few minutes." };
    return { error: error.message };
  }
  if (data.session) {
    refresh();
    redirect("/");
  }
  return { message: "Check your email and tap the confirmation link to finish signing up." };
}

export async function signInAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  const email = text(formData, "email").toLowerCase();
  const password = typeof formData.get("password") === "string" ? String(formData.get("password")) : "";
  if (!email || !password) return { error: "Enter your email and password." };
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    if (/not confirmed/i.test(error.message)) return { error: "Confirm your email first: check your inbox for the link." };
    return { error: "Wrong email or password." };
  }
  refresh();
  redirect(safeNextPath(text(formData, "next")));
}

export async function signOutAction(): Promise<void> {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  refresh();
  redirect("/");
}

export async function updateProfileAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  const displayName = text(formData, "display_name");
  const region = text(formData, "region");
  const city = text(formData, "city");
  if (displayName.length < 2 || displayName.length > 60) return { error: "Enter your name (2–60 characters)." };
  if (!isRegionCode(region)) return { error: "Choose your region." };
  if (city.length > 60) return { error: "City names are up to 60 characters." };
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Your session expired. Sign in again." };
  const { error } = await supabase.from("players")
    .update({ display_name: displayName, region, city: city || null }).eq("id", user.id);
  if (error) return { error: error.message };
  refresh();
  return { message: "Profile saved." };
}

// ---------------------------------------------------------------------------
// Matches
// ---------------------------------------------------------------------------

export async function recordMatchAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Your session expired. Sign in again." };

  const format = text(formData, "format") === "doubles" ? "doubles" : "singles";
  const partner = optionalId(formData, "partner");
  const opponent1 = optionalId(formData, "opponent1");
  const opponent2 = optionalId(formData, "opponent2");
  if (format === "doubles" && !partner) return { error: "Choose your partner." };
  if (!opponent1 || (format === "doubles" && !opponent2)) return { error: format === "doubles" ? "Choose both opponents." : "Choose your opponent." };

  let games: Game[];
  try {
    games = (JSON.parse(text(formData, "games") || "[]") as { team1: unknown; team2: unknown }[])
      .filter((game) => String(game.team1 ?? "") !== "" || String(game.team2 ?? "") !== "")
      .map((game) => ({ team1: Number(game.team1), team2: Number(game.team2) }));
  } catch {
    return { error: "Enter the game scores." };
  }
  const checked = validateGames(games);
  if ("error" in checked) return { error: checked.error };

  const playedAt = manilaInputToIso(text(formData, "played_at"));
  if (!playedAt) return { error: "Enter when the match was played." };

  const { data, error } = await callRpc("record_match", {
    p_format: format,
    p_played_at: playedAt,
    p_team1: format === "doubles" ? [user.id, partner] : [user.id],
    p_team2: format === "doubles" ? [opponent1, opponent2] : [opponent1],
    p_games: checked.games,
    p_club: optionalId(formData, "club"),
    p_location: text(formData, "location") || null,
    p_notes: text(formData, "notes") || null,
  });
  if (error) return { error };
  refresh();
  redirect(`/matches/${data as string}?recorded=1`);
}

export async function respondToMatchAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  const id = optionalId(formData, "match");
  if (!id) return { error: "Match not found." };
  const confirm = text(formData, "decision") === "confirm";
  const { error } = await callRpc("respond_to_match", { p_match: id, p_confirm: confirm });
  if (error) return { error };
  refresh();
  return { message: confirm ? "Score confirmed. Ratings are updated." : "Score disputed. An admin will review it." };
}

export async function cancelMatchAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  const id = optionalId(formData, "match");
  if (!id) return { error: "Match not found." };
  const { error } = await callRpc("cancel_match", { p_match: id });
  if (error) return { error };
  refresh();
  return { message: "Match cancelled." };
}

export async function adminResolveMatchAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  const id = optionalId(formData, "match");
  const action = text(formData, "decision");
  if (!id || (action !== "confirm" && action !== "void")) return { error: "Choose confirm or void." };
  const { error } = await callRpc("admin_resolve_match", { p_match: id, p_action: action });
  if (error) return { error };
  refresh();
  return { message: action === "confirm" ? "Match confirmed." : "Match voided and ratings recalculated." };
}

// ---------------------------------------------------------------------------
// Clubs
// ---------------------------------------------------------------------------

export async function createClubAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  const name = text(formData, "name");
  const region = text(formData, "region");
  if (name.length < 2 || name.length > 80) return { error: "Club names are 2–80 characters." };
  if (!isRegionCode(region)) return { error: "Choose the club's region." };
  const { data, error } = await callRpc("create_club", {
    p_name: name, p_region: region, p_city: text(formData, "city") || null, p_description: text(formData, "description") || null,
  });
  if (error) return { error };
  refresh();
  redirect(`/clubs/${data as string}`);
}

export async function joinClubAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  const { error } = await callRpc("join_club", { p_club: optionalId(formData, "club") });
  if (error) return { error };
  refresh();
  return { message: "You joined the club." };
}

export async function leaveClubAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  const { error } = await callRpc("leave_club", { p_club: optionalId(formData, "club") });
  if (error) return { error };
  refresh();
  return { message: "You left the club." };
}

export async function removeClubMemberAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  const { error } = await callRpc("remove_club_member", { p_club: optionalId(formData, "club"), p_player: optionalId(formData, "player") });
  if (error) return { error };
  refresh();
  return { message: "Member removed." };
}

// ---------------------------------------------------------------------------
// Tournaments
// ---------------------------------------------------------------------------

export async function createTournamentAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  const name = text(formData, "name");
  const region = text(formData, "region");
  const startsOn = text(formData, "starts_on");
  const maxEntries = Number(text(formData, "max_entries") || 16);
  if (name.length < 3 || name.length > 100) return { error: "Tournament names are 3–100 characters." };
  if (!isRegionCode(region)) return { error: "Choose the tournament's region." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startsOn)) return { error: "Choose a start date." };
  if (!Number.isInteger(maxEntries) || maxEntries < 2 || maxEntries > 64) return { error: "Allow between 2 and 64 entries." };
  const { data, error } = await callRpc("create_tournament", {
    p_name: name,
    p_format: text(formData, "format") === "doubles" ? "doubles" : "singles",
    p_starts_on: startsOn,
    p_region: region,
    p_city: text(formData, "city") || null,
    p_venue: text(formData, "venue") || null,
    p_club: optionalId(formData, "club"),
    p_max_entries: maxEntries,
    p_description: text(formData, "description") || null,
  });
  if (error) return { error };
  refresh();
  redirect(`/tournaments/${data as string}`);
}

export async function registerForTournamentAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  const { error } = await callRpc("register_for_tournament", {
    p_tournament: optionalId(formData, "tournament"), p_partner: optionalId(formData, "partner"),
  });
  if (error) return { error };
  refresh();
  return { message: "You're registered." };
}

export async function withdrawFromTournamentAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  const { error } = await callRpc("withdraw_from_tournament", { p_tournament: optionalId(formData, "tournament") });
  if (error) return { error };
  refresh();
  return { message: "You withdrew from the tournament." };
}

export async function startTournamentAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  const { error } = await callRpc("start_tournament", { p_tournament: optionalId(formData, "tournament") });
  if (error) return { error };
  refresh();
  return { message: "Registration closed and the bracket is ready." };
}

export async function cancelTournamentAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  const { error } = await callRpc("cancel_tournament", { p_tournament: optionalId(formData, "tournament") });
  if (error) return { error };
  refresh();
  return { message: "Tournament cancelled." };
}

export async function reportBracketResultAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = parseScoreLine(text(formData, "score"));
  if ("error" in parsed) return { error: parsed.error };
  const { error } = await callRpc("report_bracket_result", {
    p_bracket: optionalId(formData, "bracket"), p_games: parsed.games, p_played_at: new Date().toISOString(),
  });
  if (error) return { error };
  refresh();
  return { message: "Result saved." };
}
