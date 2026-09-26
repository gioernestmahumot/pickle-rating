const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** A player's check-in code is a link like /matches/new?add=<id> (or their /players/<id> page). */
export function playerIdFromCode(raw: string): string | null {
  try {
    const url = new URL(raw);
    const add = url.searchParams.get("add");
    if (add && UUID.test(add)) return add;
    const match = /^\/players\/([0-9a-f-]{36})\/?$/i.exec(url.pathname);
    return match && UUID.test(match[1]) ? match[1] : null;
  } catch {
    return null;
  }
}
