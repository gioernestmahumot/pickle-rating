"use client";

import { useActionState, useState } from "react";
import { recordMatchAction, type ActionState } from "@/app/actions";
import { FormMessage } from "@/components/form-message";
import { PlayerPicker } from "@/components/player-picker";
import { QrScanButton } from "@/components/qr-scan-button";
import { validateGames } from "@/lib/games";
import type { Format, PlayerSummary } from "@/lib/types";

interface GameInput {
  team1: string;
  team2: string;
}

export function MatchForm({
  me,
  clubs,
  defaultPlayedAt,
  initialOpponent,
  initialClub,
}: {
  me: PlayerSummary;
  clubs: { id: string; name: string }[];
  defaultPlayedAt: string;
  initialOpponent: PlayerSummary | null;
  initialClub: string | null;
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(recordMatchAction, {});
  const [format, setFormat] = useState<Format>("singles");
  const [partner, setPartner] = useState<PlayerSummary | null>(null);
  const [opponent1, setOpponent1] = useState<PlayerSummary | null>(initialOpponent);
  const [opponent2, setOpponent2] = useState<PlayerSummary | null>(null);
  const [games, setGames] = useState<GameInput[]>([{ team1: "", team2: "" }, { team1: "", team2: "" }, { team1: "", team2: "" }]);

  const doubles = format === "doubles";
  const chosen = [me.id, doubles ? partner?.id : null, opponent1?.id, doubles ? opponent2?.id : null].filter(Boolean) as string[];
  const filled = games.filter((game) => game.team1 !== "" || game.team2 !== "");
  const preview = filled.length ? validateGames(filled.map((game) => ({ team1: Number(game.team1), team2: Number(game.team2) }))) : null;
  const winner = preview && "games" in preview
    ? preview.games.filter((game) => game.team1 > game.team2).length * 2 > preview.games.length ? "Your team wins" : "Your opponents win"
    : null;

  // A scanned check-in code fills the first empty opponent slot, then the partner slot.
  const addScanned = (player: PlayerSummary) => {
    if (chosen.includes(player.id)) return;
    if (!opponent1) setOpponent1(player);
    else if (doubles && !opponent2) setOpponent2(player);
    else if (doubles && !partner) setPartner(player);
  };

  const setScore = (index: number, side: keyof GameInput, value: string) =>
    setGames((current) => current.map((game, i) => (i === index ? { ...game, [side]: value.replace(/\D/g, "").slice(0, 2) } : game)));

  return (
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="format" value={format} />
      <input type="hidden" name="games" value={JSON.stringify(filled)} />

      <div className="grid grid-cols-2 gap-2 rounded-2xl bg-surface-2 p-1" role="radiogroup" aria-label="Format">
        {(["singles", "doubles"] as const).map((option) => (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={format === option}
            onClick={() => setFormat(option)}
            className={`rounded-xl py-2.5 text-sm font-semibold capitalize transition ${format === option ? "bg-surface text-link shadow-sm" : "text-ink-2"}`}
          >
            {option}
          </button>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <fieldset className="space-y-3 rounded-2xl border border-line-strong bg-tint p-4">
          <legend className="px-1 text-sm font-semibold text-link">Your team</legend>
          <div>
            <span className="label">You</span>
            <div className="rounded-xl border border-line bg-surface px-3 py-2.5 text-sm font-semibold">{me.display_name}</div>
          </div>
          {doubles && <PlayerPicker name="partner" label="Partner" exclude={chosen} value={partner} onChange={setPartner} />}
        </fieldset>
        <fieldset className="space-y-3 rounded-2xl border border-line p-4">
          <legend className="px-1 text-sm font-semibold text-ink-2">Opponents</legend>
          <PlayerPicker name="opponent1" label={doubles ? "Opponent 1" : "Opponent"} exclude={chosen} value={opponent1} onChange={setOpponent1} />
          {doubles && <PlayerPicker name="opponent2" label="Opponent 2" exclude={chosen} value={opponent2} onChange={setOpponent2} />}
          <QrScanButton onPlayer={addScanned} />
        </fieldset>
      </div>

      <fieldset>
        <legend className="label">Game scores</legend>
        <p className="muted mb-3">Leave unused games empty. Enter your team&apos;s points first.</p>
        <div className="space-y-2">
          {games.map((game, index) => (
            <div key={index} className="flex items-center gap-3">
              <span className="w-16 text-sm text-ink-3">Game {index + 1}</span>
              <input className="input w-20 text-center" inputMode="numeric" aria-label={`Game ${index + 1}, your team`} value={game.team1} onChange={(event) => setScore(index, "team1", event.target.value)} />
              <span className="text-ink-4">–</span>
              <input className="input w-20 text-center" inputMode="numeric" aria-label={`Game ${index + 1}, opponents`} value={game.team2} onChange={(event) => setScore(index, "team2", event.target.value)} />
            </div>
          ))}
        </div>
        {games.length < 5 && (
          <button type="button" className="mt-2 text-sm font-medium text-link hover:underline" onClick={() => setGames((current) => [...current, { team1: "", team2: "" }])}>
            + Add game
          </button>
        )}
        {preview && <p className={`mt-3 text-sm font-medium ${"error" in preview ? "text-warn" : "text-link"}`}>{"error" in preview ? preview.error : winner}</p>}
      </fieldset>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="label" htmlFor="played_at">Played on (Philippine time)</label>
          <input id="played_at" name="played_at" type="datetime-local" className="input" defaultValue={defaultPlayedAt} required />
        </div>
        <div>
          <label className="label" htmlFor="club">Club (optional)</label>
          <select id="club" name="club" className="input" defaultValue={initialClub ?? ""}>
            <option value="">Not a club match</option>
            {clubs.map((club) => <option key={club.id} value={club.id}>{club.name}</option>)}
          </select>
          <p className="mt-1 text-xs text-ink-3">Club matches also count toward that club&apos;s rankings. Everyone must be a member.</p>
        </div>
        <div>
          <label className="label" htmlFor="location">Court / venue (optional)</label>
          <input id="location" name="location" className="input" maxLength={120} placeholder="e.g. Ayala Triangle courts" />
        </div>
        <div>
          <label className="label" htmlFor="notes">Notes (optional)</label>
          <input id="notes" name="notes" className="input" maxLength={280} />
        </div>
      </div>

      <FormMessage state={state} />
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <button type="submit" className="btn-primary" disabled={pending}>{pending ? "Saving…" : "Record match"}</button>
        <p className="muted">Ratings change once someone on the other team confirms the score.</p>
      </div>
    </form>
  );
}
