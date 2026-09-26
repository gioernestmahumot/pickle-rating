import Link from "next/link";
import { BottomNav, HeaderNav } from "@/components/nav";
import { ThemeToggle } from "@/components/theme-toggle";
import { getMatchesAwaitingPlayer } from "@/lib/matches";
import { getSession } from "@/lib/session";

export function Logo() {
  return (
    <svg className="size-7 shrink-0" viewBox="0 0 30 30" aria-hidden="true">
      <circle cx="15" cy="15" r="13" className="fill-accent" />
      {[[10, 11], [18, 9], [20, 17], [12, 19], [15, 14]].map(([cx, cy]) => <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="1.8" fill="#1b2a4a" />)}
    </svg>
  );
}

export function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : parts[0]?.[1] ?? "")).toUpperCase();
}

export async function SiteHeader() {
  const { supabase, player } = await getSession();
  const pendingCount = player ? (await getMatchesAwaitingPlayer(supabase, player.id)).length : 0;

  return (
    <>
      <header className="sticky top-0 z-30 bg-brand text-brand-ink">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-4 md:h-[72px] md:px-8">
          <Link href="/" className="flex items-center gap-2.5 text-brand-ink">
            <Logo />
            <span className="font-display text-xl font-extrabold tracking-tight">Pickle Rating</span>
          </Link>
          <HeaderNav pendingCount={pendingCount} />
          <div className="ml-auto flex items-center gap-2 md:gap-3">
            <ThemeToggle />
            {player ? (
              <>
                <Link href="/matches/new" className="btn-accent hidden md:inline-flex">
                  <svg className="size-4" viewBox="0 0 16 16" aria-hidden="true"><path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" /></svg>
                  Record match
                </Link>
                <Link href={`/players/${player.id}`} aria-label="Your profile" className="grid size-10 place-items-center rounded-full bg-accent font-bold text-accent-ink md:size-11">
                  {initials(player.display_name)}
                </Link>
              </>
            ) : (
              <>
                <Link href="/login" className="rounded-xl px-3 py-2 text-sm font-semibold text-brand-ink-2 hover:text-brand-ink">Sign in</Link>
                <Link href="/signup" className="btn-accent">Join</Link>
              </>
            )}
          </div>
        </div>
      </header>
      <BottomNav pendingCount={pendingCount} />
    </>
  );
}
