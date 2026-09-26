"use client";

import { createBrowserClient } from "@supabase/ssr";
import { getSupabaseConfig, SETUP_MESSAGE } from "@/lib/supabase/config";

let client: ReturnType<typeof createBrowserClient> | undefined;

export function getSupabaseBrowserClient() {
  const config = getSupabaseConfig();
  if (!config) throw new Error(SETUP_MESSAGE);
  client ??= createBrowserClient(config.url, config.key);
  return client;
}
