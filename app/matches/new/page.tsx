import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { MatchForm } from "@/components/match-form";
import { manilaNowForInput } from "@/lib/format";
import { getSession } from "@/lib/session";
import type { PlayerSummary } from "@/lib/types";

export const metadata: Metadata = { title: "Record a match" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value) ?? "";

export default async function NewMatchPage({ searchParams }: PageProps<"/matches/new">) {
  const params = await searchParams;
  const { supabase, player } = await getSession();
  if (!player) redirect("/login?next=/matches/new");

  // ?add=<id> comes from scanning someone's check-in code with the phone camera.
  const addId = one(params.add);
  const clubId = one(params.club);
  const [added, memberships] = await Promise.all([
    UUID.test(addId) && addId !== player.id
      ? supabase.from("players").select("id, display_name, region, city").eq("id", addId).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase.from("club_members").select("clubs(id, name)").eq("player_id", player.id),
  ]);
  const clubs = ((memberships.data ?? []) as unknown as { clubs: { id: string; name: string } | null }[])
    .flatMap((row) => (row.clubs ? [row.clubs] : []))
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link href="/matches" className="link text-sm">← Matches</Link>
        <h1 className="page-title mt-2">Record a match</h1>
        <p className="mt-1 text-ink-2">Ratings change once someone on the other team confirms the score.</p>
      </div>
      <MatchForm
        me={{ id: player.id, display_name: player.display_name, region: player.region, city: player.city }}
        clubs={clubs}
        defaultPlayedAt={manilaNowForInput()}
        initialOpponent={(added.data as PlayerSummary | null) ?? null}
        initialClub={clubs.some((club) => club.id === clubId) ? clubId : null}
      />
    </div>
  );
}
