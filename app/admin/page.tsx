import type { Metadata } from "next";
import Link from "next/link";
import { setFeedbackStatusAction } from "@/app/actions";
import { ActionButton } from "@/components/action-button";
import { FEEDBACK_KINDS } from "@/lib/feedback";
import { MatchList } from "@/components/match-list";
import { daysAgoIso, formatDateTime } from "@/lib/format";
import { MATCH_SELECT, type MatchView } from "@/lib/matches";
import { getSession } from "@/lib/session";

export const metadata: Metadata = { title: "Admin" };

type Supabase = Awaited<ReturnType<typeof getSession>>["supabase"];
type FeedbackStatus = "new" | "seen" | "done";
interface FeedbackRow {
  id: string;
  kind: "suggestion" | "problem" | "score";
  message: string;
  status: FeedbackStatus;
  created_at: string;
  players: { id: string; display_name: string; city: string | null } | null;
}

const KIND_STYLE: Record<FeedbackRow["kind"], string> = {
  suggestion: "bg-tint text-link",
  problem: "bg-bad-tint text-bad",
  score: "bg-warn-tint text-warn",
};

const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value) ?? "";

export default async function AdminPage({ searchParams }: PageProps<"/admin">) {
  const params = await searchParams;
  const tab = one(params.tab) === "feedback" ? "feedback" : "disputes";
  const statusParam = one(params.status);
  const status: FeedbackStatus | "all" = statusParam === "seen" || statusParam === "done" || statusParam === "all" ? statusParam : "new";
  const { supabase, player } = await getSession();
  if (!player?.is_admin) {
    return (
      <div className="mx-auto max-w-lg text-center">
        <h1 className="page-title">Admins only</h1>
        <p className="mt-2 text-ink-2">This page is for Pickle Rating admins who settle disputed scores and read feedback.</p>
        <Link href="/" className="link mt-4 inline-block">Back to rankings</Link>
      </div>
    );
  }

  const count = async (table: "matches" | "feedback", value: string) =>
    (await supabase.from(table).select("id", { count: "exact", head: true }).eq("status", value)).count ?? 0;
  const [disputedCount, newCount, seenCount, doneCount] = await Promise.all([
    count("matches", "disputed"), count("feedback", "new"), count("feedback", "seen"), count("feedback", "done"),
  ]);

  const tabLink = (id: "disputes" | "feedback", label: string, badge: number, highlight: boolean) => (
    <Link
      href={id === "feedback" ? "/admin?tab=feedback" : "/admin"}
      aria-current={tab === id ? "page" : undefined}
      className={`-mb-px border-b-[3px] px-1 py-3 text-[15px] ${tab === id ? "border-link font-bold text-ink" : "border-transparent font-semibold text-ink-2"}`}
    >
      {label}
      {badge > 0 && <span className={`ml-2 rounded-full px-2 py-0.5 text-xs ${highlight ? "bg-accent text-accent-ink" : "bg-surface-2"}`}>{highlight ? `${badge} new` : badge}</span>}
    </Link>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Admin</h1>
        <p className="mt-1 text-ink-2">Settle disputed scores and read what players send you.</p>
      </div>
      <nav aria-label="Admin sections" className="flex gap-6 border-b border-line">
        {tabLink("disputes", "Disputed matches", disputedCount, false)}
        {tabLink("feedback", "Feedback", newCount, true)}
      </nav>
      {tab === "disputes" ? <Disputes supabase={supabase} /> : (
        <>
          <div className="flex flex-wrap gap-2">
            {([["new", `New · ${newCount}`], ["seen", `Seen · ${seenCount}`], ["done", `Done · ${doneCount}`], ["all", "All"]] as const).map(([value, label]) => (
              <Link key={value} href={`/admin?tab=feedback&status=${value}`}
                className={`grid min-h-10 place-items-center rounded-full border px-4 text-sm font-semibold ${status === value ? "border-brand bg-brand text-brand-ink" : "border-line-strong bg-surface text-ink"}`}>
                {label}
              </Link>
            ))}
          </div>
          <FeedbackList supabase={supabase} status={status} />
        </>
      )}
    </div>
  );
}

async function Disputes({ supabase }: { supabase: Supabase }) {
  const [{ data: disputed }, { data: stale }] = await Promise.all([
    supabase.from("matches").select(MATCH_SELECT).eq("status", "disputed").order("created_at", { ascending: true }).limit(100),
    supabase.from("matches").select(MATCH_SELECT).eq("status", "pending").lt("created_at", daysAgoIso(14)).order("created_at").limit(50),
  ]);
  return (
    <>
      <p className="muted">Open a match to confirm it or void it. Voiding a confirmed match recalculates ratings without it.</p>
      <section className="card">
        <h2 className="section-title">Disputed matches</h2>
        <MatchList matches={(disputed ?? []) as unknown as MatchView[]} empty="No disputes." />
      </section>
      <section className="card">
        <h2 className="section-title">Pending for over 2 weeks</h2>
        <MatchList matches={(stale ?? []) as unknown as MatchView[]} empty="None." />
      </section>
    </>
  );
}

async function FeedbackList({ supabase, status }: { supabase: Supabase; status: FeedbackStatus | "all" }) {
  let query = supabase.from("feedback").select("id, kind, message, status, created_at, players(id, display_name, city)")
    .order("created_at", { ascending: false }).limit(100);
  if (status !== "all") query = query.eq("status", status);
  const rows = ((await query).data ?? []) as unknown as FeedbackRow[];
  if (!rows.length) return <p className="muted py-6">{status === "new" ? "No new feedback." : "Nothing here."}</p>;
  return (
    <div className="space-y-3">
      {rows.map((row) => (
        <article key={row.id} className="card grid gap-4 md:grid-cols-[minmax(0,1fr)_200px] md:items-start">
          <div className="min-w-0 space-y-2">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${KIND_STYLE[row.kind]}`}>{FEEDBACK_KINDS.find((k) => k.value === row.kind)?.label}</span>
              {row.players && <Link href={`/players/${row.players.id}`} className="link">{row.players.display_name}</Link>}
              <span className="text-[13px] text-ink-3">{[row.players?.city, formatDateTime(row.created_at)].filter(Boolean).join(" · ")}</span>
              {status === "all" && <span className="text-xs font-bold text-ink-3 uppercase">{row.status}</span>}
            </div>
            <p className="leading-relaxed whitespace-pre-line">{row.message}</p>
          </div>
          <div className="flex flex-col gap-2">
            {row.status === "new" && <ActionButton action={setFeedbackStatusAction} fields={{ feedback: row.id, status: "seen" }} label="Mark seen" className="btn-secondary w-full" />}
            {row.status !== "done" && <ActionButton action={setFeedbackStatusAction} fields={{ feedback: row.id, status: "done" }} label="Mark done" className="btn-primary w-full" />}
            {row.status === "done" && <ActionButton action={setFeedbackStatusAction} fields={{ feedback: row.id, status: "new" }} label="Reopen" className="btn-secondary w-full" />}
          </div>
        </article>
      ))}
    </div>
  );
}
