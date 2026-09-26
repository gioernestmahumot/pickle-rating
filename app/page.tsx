import Link from "next/link";
import { ActionButton } from "@/components/action-button";
import { MatchList } from "@/components/match-list";
import { respondToMatchAction } from "@/app/actions";
import { isProvisional } from "@/lib/elo";
import { formatGames, winRate } from "@/lib/format";
import { getMatchesAwaitingPlayer, getRecentConfirmedMatches, team } from "@/lib/matches";
import { REGIONS, isRegionCode, regionName } from "@/lib/regions";
import { getSession } from "@/lib/session";
import { formatLabel, parseFormat, type Format, type Player } from "@/lib/types";

const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value) ?? "";

function rankingsHref(params: { format: Format; region: string | null; city: string; q?: string }) {
  const search = new URLSearchParams();
  if (params.format !== "singles") search.set("format", params.format);
  if (params.region) search.set("region", params.region);
  if (params.city) search.set("city", params.city);
  if (params.q) search.set("q", params.q);
  const query = search.toString();
  return query ? `/?${query}` : "/";
}

function Filters({ idPrefix, format, region, city, q }: { idPrefix: string; format: Format; region: string | null; city: string; q: string }) {
  return (
    <form className="grid gap-3 sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-end" action="/">
      {format !== "singles" && <input type="hidden" name="format" value={format} />}
      <div>
        <label className="label" htmlFor={`${idPrefix}region`}>Region</label>
        <select id={`${idPrefix}region`} name="region" className="input" defaultValue={region ?? ""}>
          <option value="">All of the Philippines</option>
          {REGIONS.map((option) => <option key={option.code} value={option.code}>{option.name}</option>)}
        </select>
      </div>
      <div>
        <label className="label" htmlFor={`${idPrefix}city`}>City</label>
        <input id={`${idPrefix}city`} name="city" className="input" placeholder="Any city" defaultValue={city} />
      </div>
      <div>
        <label className="label" htmlFor={`${idPrefix}q`}>Find a player</label>
        <input id={`${idPrefix}q`} name="q" className="input" placeholder="Name" defaultValue={q} />
      </div>
      <button type="submit" className="btn-secondary">Show</button>
    </form>
  );
}

export default async function RankingsPage({ searchParams }: PageProps<"/">) {
  const params = await searchParams;
  const format = parseFormat(one(params.format));
  const region = isRegionCode(one(params.region)) ? one(params.region) : null;
  const city = one(params.city).trim().slice(0, 60);
  const q = one(params.q).trim().slice(0, 60);
  const { supabase, player } = await getSession();

  let query = supabase.from("players")
    .select("id, display_name, region, city, singles_rating, doubles_rating, singles_played, doubles_played, singles_wins, doubles_wins")
    .gt(`${format}_played`, 0)
    .order(`${format}_rating`, { ascending: false })
    .order(`${format}_wins`, { ascending: false })
    .limit(200);
  if (region) query = query.eq("region", region);
  // ILIKE without wildcards is a case-insensitive exact match.
  if (city) query = query.ilike("city", city.replace(/[\\%_]/g, (char) => `\\${char}`));
  const { data } = await query;
  const ranked = ((data ?? []) as Player[]).map((row, index) => ({ ...row, rank: index + 1 }));
  const rows = (q ? ranked.filter((row) => row.display_name.toLowerCase().includes(q.toLowerCase())) : ranked).slice(0, 100);

  const [waiting, recent] = await Promise.all([
    player ? getMatchesAwaitingPlayer(supabase, player.id) : Promise.resolve([]),
    getRecentConfirmedMatches(supabase, 6),
  ]);

  const scope = city ? `${city}${region ? `, ${regionName(region)}` : ""}` : region ? regionName(region) : "Philippines";
  const chips = [
    { label: "Philippines", href: rankingsHref({ format, region: null, city: "" }), active: !region && !city },
    ...(player ? [
      { label: regionName(player.region), href: rankingsHref({ format, region: player.region, city: "" }), active: region === player.region && !city },
      ...(player.city ? [{ label: player.city, href: rankingsHref({ format, region: player.region, city: player.city }), active: city.toLowerCase() === player.city.toLowerCase() }] : []),
    ] : []),
  ];

  return (
    <div className="space-y-6">
      {one(params.password) === "updated" && <p role="status" className="rounded-xl bg-good-tint px-4 py-3 text-sm text-good">Your password was updated.</p>}
      <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="eyebrow">{scope} · {formatLabel(format)}</p>
          <h1 className="page-title mt-1.5">Pickleball rankings</h1>
          <p className="mt-2 text-ink-2">Ratings from real, confirmed matches. No DUPR needed.</p>
        </div>
        <div role="group" aria-label="Format" className="grid grid-cols-2 rounded-2xl bg-surface-2 p-1 md:flex">
          {(["singles", "doubles"] as const).map((option) => (
            <Link
              key={option}
              href={rankingsHref({ format: option, region, city, q })}
              aria-current={format === option ? "true" : undefined}
              className={`grid min-h-11 place-items-center rounded-xl px-6 text-[15px] font-bold ${format === option ? "bg-surface text-link shadow-sm" : "text-ink-2"}`}
            >
              {formatLabel(option)}
            </Link>
          ))}
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1 md:hidden">
        {chips.map((chip) => (
          <Link key={chip.label} href={chip.href} className={`grid min-h-11 shrink-0 place-items-center rounded-full border px-4 text-sm font-semibold ${chip.active ? "border-brand bg-brand text-brand-ink" : "border-line-strong bg-surface text-ink"}`}>
            {chip.label}
          </Link>
        ))}
      </div>

      {/* Phones get the quick chips above; the full filters fold away. */}
      <details className="rounded-2xl border border-line bg-surface md:hidden">
        <summary className="flex min-h-11 cursor-pointer items-center px-4 text-sm font-semibold text-link">More filters</summary>
        <div className="border-t border-line p-4"><Filters idPrefix="m-" format={format} region={region} city={city} q={q} /></div>
      </details>
      <div className="hidden md:block"><Filters idPrefix="d-" format={format} region={region} city={city} q={q} /></div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
        <section aria-label="Leaderboard" className="overflow-hidden rounded-2xl border border-line bg-surface">
          <div className="hidden grid-cols-[64px_minmax(0,1fr)_110px_90px_80px] border-b border-line px-5 py-3 text-xs font-bold tracking-wide text-ink-3 uppercase sm:grid">
            <span>Rank</span><span>Player</span><span className="text-right">Rating</span><span className="text-right">W–L</span><span className="text-right">Win %</span>
          </div>
          {rows.length === 0 ? (
            <div className="p-8 text-center">
              <p className="font-semibold">No rated {format} players {city || region ? "here" : ""} yet.</p>
              <p className="muted mt-1">Ratings appear after a player&apos;s first confirmed match.</p>
              <Link href="/matches/new" className="btn-primary mt-4">Record a match</Link>
            </div>
          ) : (
            <ol>
              {rows.map((row) => {
                const played = row[`${format}_played`];
                const wins = row[`${format}_wins`];
                return (
                  <li key={row.id} className="border-b border-line last:border-0">
                    <Link href={`/players/${row.id}`} className={`flex items-center gap-3 px-4 py-3 hover:bg-surface-2 sm:grid sm:grid-cols-[64px_minmax(0,1fr)_110px_90px_80px] sm:px-5 ${row.id === player?.id ? "bg-tint" : ""}`}>
                      <span className={`num w-7 text-lg sm:w-auto sm:text-xl ${row.rank <= 3 ? "text-link" : "text-ink-4"}`}>{row.rank}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-bold">{row.display_name}{row.id === player?.id && <span className="ml-1.5 text-xs font-semibold text-link">you</span>}</span>
                        <span className="block truncate text-xs text-ink-3 sm:text-[13px]">{[row.city, regionName(row.region)].filter(Boolean).join(" · ")}</span>
                      </span>
                      <span className="text-right">
                        <span className="num block text-lg sm:text-xl">
                          {row[`${format}_rating`]}
                          {isProvisional(played) && <abbr title="Provisional: fewer than 5 rated matches" className="ml-1 align-top text-xs font-bold text-ink-4 no-underline">P</abbr>}
                        </span>
                        <span className="block text-xs text-ink-3 sm:hidden">{wins}–{played - wins}</span>
                      </span>
                      <span className="hidden text-right text-[15px] text-ink-2 sm:block">{wins}–{played - wins}</span>
                      <span className="hidden text-right text-[15px] font-semibold text-ink-2 sm:block">{winRate(wins, played)}</span>
                    </Link>
                  </li>
                );
              })}
            </ol>
          )}
          <p className="border-t border-line px-5 py-3 text-xs text-ink-3">
            P = provisional (fewer than 5 rated matches). Ratings start at 1500. <Link href="/help?open=calculated#calculated" className="font-semibold text-link hover:underline">How ratings work</Link>
          </p>
        </section>

        <aside className="space-y-5">
          {waiting.length > 0 && (
            <section className="rounded-2xl bg-brand p-5 text-brand-ink">
              <p className="text-xs font-bold tracking-[0.1em] text-accent uppercase">Waiting for you</p>
              {waiting.slice(0, 1).map((match) => {
                const recorder = match.match_players.find((p) => p.player_id === match.created_by)?.players.display_name ?? "A player";
                return (
                  <div key={match.id} className="mt-2 space-y-3">
                    <p className="leading-relaxed">
                      {recorder} recorded a {match.format} match with you: <strong>{formatGames(match.games)}</strong>{" "}
                      <span className="text-brand-ink-2">({team(match, 1).map((p) => p.display_name).join(" & ")} first)</span>
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      <ActionButton action={respondToMatchAction} fields={{ match: match.id, decision: "confirm" }} label="Confirm" className="btn-accent w-full" />
                      <Link href={`/matches/${match.id}`} className="btn w-full border border-brand-ink-2/40 text-brand-ink">Review</Link>
                    </div>
                  </div>
                );
              })}
              {waiting.length > 1 && <Link href="/matches" className="mt-3 block text-sm font-semibold text-brand-ink-2 hover:text-brand-ink">{waiting.length - 1} more waiting →</Link>}
            </section>
          )}
          <section className="card">
            <h2 className="section-title">Recent matches</h2>
            <MatchList matches={recent} empty="No confirmed matches yet." />
          </section>
        </aside>
      </div>
    </div>
  );
}
