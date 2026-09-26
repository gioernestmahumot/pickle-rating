import "server-only";
import { cache } from "react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Player } from "@/lib/types";

/** The signed-in player, looked up once per request (header and page share it). */
export const getSession = cache(async () => {
  const supabase = await createSupabaseServerClient();
  // getClaims verifies the token without a round trip to the Auth server.
  const { data: claimsData } = await supabase.auth.getClaims();
  const claims = claimsData?.claims;
  const user = claims?.sub ? { id: claims.sub, email: typeof claims.email === "string" ? claims.email : null } : null;
  if (!user) return { supabase, user: null, player: null as Player | null };
  const { data } = await supabase.from("players").select("*").eq("id", user.id).maybeSingle();
  return { supabase, user, player: data as Player | null };
});
