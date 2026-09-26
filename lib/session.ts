import "server-only";
import { cache } from "react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Player } from "@/lib/types";

/** The signed-in player, looked up once per request (header and page share it). */
export const getSession = cache(async () => {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, player: null as Player | null };
  const { data } = await supabase.from("players").select("*").eq("id", user.id).maybeSingle();
  return { supabase, user, player: data as Player | null };
});
