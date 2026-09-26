import type { Metadata } from "next";
import Link from "next/link";
import { CreateClubForm } from "@/components/forms";
import { REGIONS, isRegionCode, regionName } from "@/lib/regions";
import { getSession } from "@/lib/session";

export const metadata: Metadata = { title: "Clubs" };

export default async function ClubsPage({ searchParams }: PageProps<"/clubs">) {
  const regionParam = (await searchParams).region;
  const region = typeof regionParam === "string" && isRegionCode(regionParam) ? regionParam : null;
  const { supabase, player } = await getSession();
  let query = supabase.from("clubs").select("id, name, region, city, description, club_members(count)").order("name").limit(200);
  if (region) query = query.eq("region", region);
  const { data } = await query;
  const clubs = (data ?? []) as unknown as { id: string; name: string; region: string; city: string | null; description: string | null; club_members: { count: number }[] }[];
  const { data: mine } = player ? await supabase.from("club_members").select("club_id").eq("player_id", player.id) : { data: [] };
  const myClubs = new Set(((mine ?? []) as { club_id: string }[]).map((row) => row.club_id));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Clubs</h1>
        <p className="mt-1 text-ink-2">Each club keeps its own rankings, calculated only from matches played inside the club.</p>
      </div>
      <form action="/clubs" className="flex max-w-md items-end gap-2">
        <div className="flex-1">
          <label className="label" htmlFor="club-region">Region</label>
          <select id="club-region" name="region" className="input" defaultValue={region ?? ""}>
            <option value="">All regions</option>
            {REGIONS.map((option) => <option key={option.code} value={option.code}>{option.name}</option>)}
          </select>
        </div>
        <button type="submit" className="btn-secondary">Show</button>
      </form>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start">
        <section className="grid gap-3 sm:grid-cols-2">
          {clubs.length === 0 && <p className="muted">No clubs here yet. Start the first one.</p>}
          {clubs.map((club) => (
            <Link key={club.id} href={`/clubs/${club.id}`} className="card block p-4 hover:border-line-strong">
              <p className="eyebrow">{[club.city, regionName(club.region)].filter(Boolean).join(" · ")}</p>
              <p className="mt-1 font-display text-xl font-extrabold">{club.name}</p>
              {club.description && <p className="mt-1 line-clamp-2 text-sm text-ink-2">{club.description}</p>}
              <p className="mt-2 text-sm text-ink-3">
                {club.club_members[0]?.count ?? 0} members
                {myClubs.has(club.id) && <span className="ml-2 rounded-full bg-good-tint px-2 py-0.5 text-xs font-bold text-good">Member</span>}
              </p>
            </Link>
          ))}
        </section>
        <aside className="card">
          <h2 className="section-title">Start a club</h2>
          {player ? <div className="mt-3"><CreateClubForm defaultRegion={player.region} /></div> : (
            <p className="muted mt-2"><Link href="/login?next=/clubs" className="link">Sign in</Link> to start a club.</p>
          )}
        </aside>
      </div>
    </div>
  );
}
