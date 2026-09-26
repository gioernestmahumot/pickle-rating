import "server-only";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { getSupabaseConfig, SETUP_MESSAGE } from "@/lib/supabase/config";

/** Supabase client for Server Components, Server Actions and Route Handlers. */
export async function createSupabaseServerClient() {
  const config = getSupabaseConfig();
  if (!config) throw new Error(SETUP_MESSAGE);
  const cookieStore = await cookies();
  return createServerClient(config.url, config.key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        // Server Components cannot set cookies; the proxy refreshes the session
        // on every request, so skipping it here is safe.
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          /* read-only in Server Components */
        }
      },
    },
  });
}
