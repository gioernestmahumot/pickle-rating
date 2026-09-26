"use client";

import { useEffect, useId, useState } from "react";
import { regionName } from "@/lib/regions";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type { PlayerSummary } from "@/lib/types";

/** Search-as-you-type player chooser. Submits the chosen player's id as `name`. */
export function PlayerPicker({
  name,
  label,
  exclude,
  value,
  onChange,
}: {
  name: string;
  label: string;
  exclude: string[];
  value: PlayerSummary | null;
  onChange: (player: PlayerSummary | null) => void;
}) {
  const id = useId();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PlayerSummary[]>([]);
  const [searching, setSearching] = useState(false);
  const term = query.trim();
  const excludeKey = exclude.join(",");

  useEffect(() => {
    if (term.length < 2) return;
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      setSearching(true);
      // % and _ are wildcards in ILIKE; treat them as plain text.
      const pattern = `%${term.replace(/[\\%_]/g, (char) => `\\${char}`)}%`;
      const { data } = await getSupabaseBrowserClient().from("players")
        .select("id, display_name, region, city").ilike("display_name", pattern).order("display_name").limit(8);
      if (cancelled) return;
      const hidden = new Set(excludeKey.split(","));
      setResults(((data ?? []) as PlayerSummary[]).filter((player) => !hidden.has(player.id)));
      setSearching(false);
    }, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [term, excludeKey]);

  if (value) {
    return (
      <div>
        <span className="label">{label}</span>
        <input type="hidden" name={name} value={value.id} />
        <div className="flex items-center justify-between gap-3 rounded-xl border border-line-strong bg-tint px-3 py-2.5">
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold text-ink">{value.display_name}</span>
            <span className="block truncate text-xs text-ink-3">{[value.city, regionName(value.region)].filter(Boolean).join(", ")}</span>
          </span>
          <button type="button" className="text-sm font-medium text-link hover:underline" onClick={() => onChange(null)}>Change</button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      <label className="label" htmlFor={id}>{label}</label>
      <input
        id={id}
        className="input"
        placeholder="Type a name…"
        autoComplete="off"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />
      {term.length >= 2 && (
        <ul className="absolute z-20 mt-1 max-h-72 w-full overflow-auto rounded-xl border border-line bg-surface py-1 shadow-lg">
          {searching && !results.length && <li className="px-3 py-2 text-sm text-ink-3">Searching…</li>}
          {!searching && !results.length && <li className="px-3 py-2 text-sm text-ink-3">No players found. They need to sign up first.</li>}
          {results.map((player) => (
            <li key={player.id}>
              <button
                type="button"
                className="block w-full px-3 py-2 text-left hover:bg-surface-2"
                onClick={() => {
                  onChange(player);
                  setQuery("");
                  setResults([]);
                }}
              >
                <span className="block text-sm font-semibold text-ink">{player.display_name}</span>
                <span className="block text-xs text-ink-3">{[player.city, regionName(player.region)].filter(Boolean).join(", ")}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
