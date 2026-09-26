import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MatchList } from "@/components/match-list";
import { QrCode } from "@/components/qr-code";
import { RatingChart } from "@/components/rating-chart";
import { initials } from "@/components/site-header";
import { isProvisional } from "@/lib/elo";
import { winRate } from "@/lib/format";
import { getPlayerMatches } from "@/lib/matches";
import { regionName } from "@/lib/regions";
import { getSession } from "@/lib/session";
import { getSiteOrigin } from "@/lib/site";
import { formatLabel, FORMATS, parseFormat, type Format, type Player } from "@/lib/types";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function loadPlayer(id: string) {
  if (!UUID.test(id)) return null;
  const { supabase } = await getSession();
  const { data } = await supabase.from("players").select("*").eq("id", id).maybeSingle();
  return data as Player | null;
}

export async function generateMetadata({ params }: PageProps<"/players/[id]">): Promise<Metadata> {
  const player = await loadPlayer((await params).id);
  return { title: player?.display_name ?? "Player" };
}

export default async function PlayerPage({ params, searchParams }: PageProps<"/players/[id]">) {
  const { id } = await params;
  const chartFormatParam = (await searchParams).chart;
  const profile = await loadPlayer(id);
  if (!profile) notFound();
  const { supabase, player: me } = await getSession();
  const isMe = me?.id === profile.id;

  // Rank = 1 + rated players with a higher rating (nationally, then in the region).
  const rankFor = async (format: Format, region?: string) => {
    let query = supabase.from("players").select("id", { count: "exact", head: true })
      .gt(`${format}_played`, 0).gt(`${format}_rating`, profile[`${format}_rating`]);
    if (region) query = query.eq("region", region);
    const { count } = await query;
    return (count ?? 0) + 1;
  };
  const defaultChart: Format = profile.doubles_played > profile.singles_played ? "doubles" : "singles";
  const chartFormat = chartFormatParam ? parseFormat(chartFormatParam) : defaultChart;

  const [ranks, history, partners, clubs, matches] = await Promise.all([
    Promise.all(FORMATS.map(async (format) => profile[`${format}_played`] > 0
      ? { national: await rankFor(format), regional: await rankFor(format, profile.region) }
      : null)),
    supabase.from("rating_history").select("rating_before, rating_after, created_at")
      .eq("player_id", profile.id).eq("format", chartFormat).order("id", { ascending: false }).limit(30),
    supabase.from("partner_stats").select("partner_id, matches, wins").eq("player_id", profile.id).order("matches", { ascending: false }).limit(8),
    supabase.from("club_members").select("role, clubs(id, name)").eq("player_id", profile.id),
    getPlayerMatches(supabase, profile.id, 30),
  ]);

  const historyRows = ((history.data ?? []) as { rating_before: number; rating_after: number; created_at: string }[]).reverse();
  const points = historyRows.length ? [{ rating: historyRows[0].rating_before, at: historyRows[0].created_at }, ...historyRows.map((h) => ({ rating: h.rating_after, at: h.created_at }))] : [];

  const partnerRows = (partners.data ?? []) as { partner_id: string; matches: number; wins: number }[];
  const { data: partnerNames } = partnerRows.length
    ? await supabase.from("players").select("id, display_name, city").in("id", partnerRows.map((p) => p.partner_id))
    : { data: [] };
  const nameOf = new Map(((partnerNames ?? []) as { id: string; display_name: string; city: string | null }[]).map((p) => [p.id, p]));
  const clubRows = ((clubs.data ?? []) as unknown as { role: string; clubs: { id: string; name: string } | null }[]).filter((c) => c.clubs);

  return (
    <div className="space-y-6">
      <section className="-mx-4 -mt-6 bg-brand px-4 py-6 text-brand-ink md:mx-0 md:mt-0 md:rounded-2xl md:p-8">
        <div className="flex items-center gap-4">
          <div className="num grid size-16 shrink-0 place-items-center rounded-full bg-accent text-2xl text-accent-ink md:size-20 md:text-3xl">{initials(profile.display_name)}</div>
          <div className="min-w-0">
            <h1 className="font-display text-3xl font-extrabold tracking-tight md:text-4xl">{profile.display_name}</h1>
            <p className="text-brand-ink-2">{[profile.city, regionName(profile.region)].filter(Boolean).join(" · ")}</p>
          </div>
          {isMe && <Link href="/profile" className="ml-auto hidden rounded-xl border border-brand-ink-2/40 px-4 py-2 text-sm font-semibold md:block">Edit profile</Link>}
        </div>
        {clubRows.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {clubRows.map((c) => <Link key={c.clubs!.id} href={`/clubs/${c.clubs!.id}`} className="rounded-full bg-brand-2 px-3 py-1.5 text-sm font-semibold">{c.clubs!.name}</Link>)}
          </div>
        )}
        {isMe && (
          <div className="mt-4 flex gap-4 text-sm font-semibold text-brand-ink-2">
            <Link href="/profile" className="md:hidden">Edit profile</Link>
            <Link href="/feedback">Send feedback</Link>
          </div>
        )}
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-3">
            {FORMATS.map((format, index) => {
              const played = profile[`${format}_played`];
              const wins = profile[`${format}_wins`];
              const rank = ranks[index];
              return (
                <div key={format} className="card flex flex-col gap-1 p-4">
                  <p className="text-xs font-bold tracking-wide text-ink-3 uppercase">{formatLabel(format)}</p>
                  <p className="num text-4xl leading-none">
                    {profile[`${format}_rating`]}
                    {played > 0 && isProvisional(played) && <abbr title="Provisional: fewer than 5 rated matches" className="ml-1 align-top text-sm text-ink-4 no-underline">P</abbr>}
                  </p>
                  <p className="text-[13px] font-semibold text-link">
                    {rank ? `#${rank.national} national · #${rank.regional} ${regionName(profile.region)}` : "Not rated yet"}
                  </p>
                  <p className="text-[13px] text-ink-3">{played ? `${wins}–${played - wins} · ${winRate(wins, played)} wins` : "No matches yet"}</p>
                </div>
              );
            })}
          </div>

          <section className="card space-y-3">
            <div className="flex items-center justify-between gap-3">
              <h2 className="section-title">Rating trend</h2>
              <div className="flex gap-1 rounded-xl bg-surface-2 p-1 text-sm">
                {FORMATS.map((format) => (
                  <Link key={format} href={`/players/${profile.id}?chart=${format}`} scroll={false}
                    className={`rounded-lg px-3 py-1.5 font-semibold ${chartFormat === format ? "bg-surface text-link" : "text-ink-2"}`}>
                    {formatLabel(format)}
                  </Link>
                ))}
              </div>
            </div>
            <RatingChart points={points} label={`${formatLabel(chartFormat)} rating`} />
          </section>

          <section className="card">
            <h2 className="section-title">Match history</h2>
            <MatchList matches={matches} perspective={profile.id} empty="No matches recorded yet." />
          </section>
        </div>

        <aside className="space-y-6">
          <section className="card">
            <h2 className="section-title">Doubles partners</h2>
            {partnerRows.length === 0 ? <p className="muted mt-2">No confirmed doubles matches yet.</p> : (
              <ul className="mt-2 divide-y divide-line">
                {partnerRows.map((row) => {
                  const partner = nameOf.get(row.partner_id);
                  return (
                    <li key={row.partner_id}>
                      <Link href={`/players/${row.partner_id}`} className="flex items-center gap-3 py-2.5 hover:bg-surface-2">
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-bold">{partner?.display_name ?? "Player"}</span>
                          <span className="block text-xs text-ink-3">{row.matches} {row.matches === 1 ? "match" : "matches"} together · {row.wins} {row.wins === 1 ? "win" : "wins"}</span>
                        </span>
                        <span className="num text-lg text-link">{winRate(row.wins, row.matches)}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {isMe && (
            <section className="card flex flex-col items-center gap-3 text-center">
              <h2 className="section-title">Your check-in code</h2>
              <p className="muted">At the court, your opponent scans this with their phone camera to add you to the match they record.</p>
              <QrCode url={`${await getSiteOrigin()}/matches/new?add=${profile.id}`} label={`Check-in code for ${profile.display_name}`} />
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}
