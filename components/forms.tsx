"use client";

import { useActionState, useState } from "react";
import {
  createClubAction, createTournamentAction, registerForTournamentAction, reportBracketResultAction, type ActionState,
} from "@/app/actions";
import { FormMessage } from "@/components/form-message";
import { PlayerPicker } from "@/components/player-picker";
import { RegionSelect } from "@/components/region-select";
import type { PlayerSummary } from "@/lib/types";

export function CreateClubForm({ defaultRegion }: { defaultRegion?: string }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(createClubAction, {});
  return (
    <form action={action} className="space-y-4">
      <div>
        <label className="label" htmlFor="club-name">Club name</label>
        <input id="club-name" name="name" className="input" minLength={2} maxLength={80} required />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="region">Region</label>
          <RegionSelect defaultValue={defaultRegion} />
        </div>
        <div>
          <label className="label" htmlFor="club-city">City</label>
          <input id="club-city" name="city" className="input" maxLength={60} />
        </div>
      </div>
      <div>
        <label className="label" htmlFor="club-description">About the club (optional)</label>
        <textarea id="club-description" name="description" className="input min-h-24 py-2" maxLength={500} placeholder="Where and when you play, who can join" />
      </div>
      <FormMessage state={state} />
      <button type="submit" className="btn-primary" disabled={pending}>{pending ? "Creating…" : "Create club"}</button>
    </form>
  );
}

export function CreateTournamentForm({ clubs, defaultRegion, today }: { clubs: { id: string; name: string }[]; defaultRegion?: string; today: string }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(createTournamentAction, {});
  return (
    <form action={action} className="space-y-4">
      <div>
        <label className="label" htmlFor="t-name">Tournament name</label>
        <input id="t-name" name="name" className="input" minLength={3} maxLength={100} required />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label className="label" htmlFor="t-format">Format</label>
          <select id="t-format" name="format" className="input" defaultValue="singles">
            <option value="singles">Singles</option>
            <option value="doubles">Doubles</option>
          </select>
        </div>
        <div>
          <label className="label" htmlFor="t-date">Date</label>
          <input id="t-date" name="starts_on" type="date" className="input" min={today} defaultValue={today} required />
        </div>
        <div>
          <label className="label" htmlFor="t-max">Max entries</label>
          <input id="t-max" name="max_entries" type="number" className="input" min={2} max={64} defaultValue={16} required />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label className="label" htmlFor="region">Region</label>
          <RegionSelect defaultValue={defaultRegion} />
        </div>
        <div>
          <label className="label" htmlFor="t-city">City</label>
          <input id="t-city" name="city" className="input" maxLength={60} />
        </div>
        <div>
          <label className="label" htmlFor="t-venue">Venue</label>
          <input id="t-venue" name="venue" className="input" maxLength={120} />
        </div>
      </div>
      {clubs.length > 0 && (
        <div>
          <label className="label" htmlFor="t-club">Club tournament? (optional)</label>
          <select id="t-club" name="club" className="input" defaultValue="">
            <option value="">Open to everyone</option>
            {clubs.map((club) => <option key={club.id} value={club.id}>{club.name} members only</option>)}
          </select>
          <p className="mt-1 text-xs text-ink-3">Club tournament results also count toward that club&apos;s rankings.</p>
        </div>
      )}
      <div>
        <label className="label" htmlFor="t-description">Details (optional)</label>
        <textarea id="t-description" name="description" className="input min-h-24 py-2" maxLength={1000} placeholder="Schedule, entry fee, rules, contact" />
      </div>
      <FormMessage state={state} />
      <button type="submit" className="btn-primary" disabled={pending}>{pending ? "Creating…" : "Create tournament"}</button>
    </form>
  );
}

/** Doubles registration: pick a partner, then register the pair. */
export function DoublesRegisterForm({ tournamentId, me }: { tournamentId: string; me: string }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(registerForTournamentAction, {});
  const [partner, setPartner] = useState<PlayerSummary | null>(null);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="tournament" value={tournamentId} />
      <PlayerPicker name="partner" label="Your partner" exclude={[me]} value={partner} onChange={setPartner} />
      <FormMessage state={state} />
      <button type="submit" className="btn-accent w-full" disabled={pending || !partner}>{pending ? "Registering…" : "Register our team"}</button>
    </form>
  );
}

export function BracketResultForm({ bracketId }: { bracketId: string }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(reportBracketResultAction, {});
  return (
    <form action={action} className="space-y-2 border-t border-line bg-tint p-3">
      <input type="hidden" name="bracket" value={bracketId} />
      <div className="flex gap-2">
        <label className="sr-only" htmlFor={`score-${bracketId}`}>Score, top side first</label>
        <input id={`score-${bracketId}`} name="score" className="input min-w-0 flex-1" placeholder="11-7, 9-11, 11-5" required />
        <button type="submit" className="btn-primary" disabled={pending}>{pending ? "…" : "Save"}</button>
      </div>
      <FormMessage state={state} />
    </form>
  );
}
