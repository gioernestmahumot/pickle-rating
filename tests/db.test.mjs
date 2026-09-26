// Runs every migration against an in-process Postgres (PGlite) with stand-ins
// for Supabase's auth schema and roles, then exercises the rules as real
// signed-in players would. Run with `npm run test:db`.
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { rateMatch } from "../lib/elo.ts";
import { REGIONS } from "../lib/regions.ts";

const db = new PGlite();
let userCount = 0;

async function asSuperuser(sql, params) {
  return (await db.query(sql, params)).rows;
}

/** Runs one statement as a signed-in player (role authenticated, auth.uid() = id). */
async function as(playerId, sql, params = []) {
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [playerId ?? ""]);
  await db.exec(playerId ? "set role authenticated" : "set role anon");
  try {
    return (await db.query(sql, params)).rows;
  } finally {
    await db.exec("reset role");
    await db.query("select set_config('request.jwt.claim.sub', '', false)");
  }
}

async function rejects(promise, pattern) {
  await assert.rejects(promise, (error) => {
    assert.match(error.message, pattern);
    return true;
  });
}

async function signUp(name, region = "NCR", city = "Makati") {
  userCount += 1;
  const id = `00000000-0000-4000-8000-${String(userCount).padStart(12, "0")}`;
  await asSuperuser(
    "insert into auth.users (id, email, raw_user_meta_data) values ($1, $2, $3)",
    [id, `${name.toLowerCase().replace(/\W/g, "")}${userCount}@example.test`, { display_name: name, region, city }],
  );
  return id;
}

async function player(id) {
  return (await asSuperuser("select * from public.players where id = $1", [id]))[0];
}

const hoursAgo = (hours) => new Date(Date.now() - hours * 3_600_000).toISOString();

async function recordMatch(by, format, team1, team2, games, club = null) {
  const rows = await as(
    by,
    "select public.record_match($1, $2, $3::uuid[], $4::uuid[], $5::jsonb, $6::uuid) as id",
    [format, hoursAgo(2), team1, team2, JSON.stringify(games), club],
  );
  return rows[0].id;
}

before(async () => {
  // Minimal stand-ins for what Supabase provides.
  await db.exec(`
    create role anon;
    create role authenticated;
    create schema auth;
    create table auth.users (
      id uuid primary key,
      email text,
      raw_user_meta_data jsonb not null default '{}'::jsonb
    );
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
    $$;
    grant usage on schema auth to anon, authenticated;
    grant usage on schema public to anon, authenticated;
  `);
  for (const file of readdirSync(new URL("../supabase/migrations/", import.meta.url)).sort()) {
    await db.exec(readFileSync(new URL(`../supabase/migrations/${file}`, import.meta.url), "utf8"));
  }
});

test("sign-up creates a player profile; invalid details reject the sign-up", async () => {
  const id = await signUp("Juan Dela Cruz", "R7", "Cebu City");
  const created = await player(id);
  assert.equal(created.display_name, "Juan Dela Cruz");
  assert.equal(created.region, "R7");
  assert.equal(created.singles_rating, 1500);
  await rejects(signUp("Bad Region", "XX"), /players_region_check/);
  await rejects(signUp("X"), /players_display_name_check/);
});

test("every region code in lib/regions.ts is accepted by the database", async () => {
  for (const region of REGIONS) await signUp(`Region ${region.code}`, region.code);
});

test("players read everything publicly but cannot write tables directly", async () => {
  const a = await signUp("Reader A");
  assert.ok((await as(null, "select count(*)::int as n from public.players"))[0].n > 0);
  await rejects(as(a, "update public.players set singles_rating = 3000 where id = $1", [a]), /permission denied/);
  await rejects(as(a, "update public.players set is_admin = true where id = $1", [a]), /permission denied/);
  await rejects(
    as(a, "insert into public.matches (format, played_at, games, winner_team, created_by) values ('singles', now(), '[]', 1, $1)", [a]),
    /permission denied/,
  );
  await as(a, "update public.players set display_name = 'Reader Renamed', city = 'Pasig' where id = $1", [a]);
  assert.equal((await player(a)).display_name, "Reader Renamed");
  // Another player's row is invisible to UPDATE (RLS), so nothing changes.
  const b = await signUp("Reader B");
  await as(a, "update public.players set display_name = 'Hacked' where id = $1", [b]);
  assert.equal((await player(b)).display_name, "Reader B");
  await rejects(as(null, "select public.record_match('singles', now(), array[$1]::uuid[], array[$2]::uuid[], '[]')", [a, b]), /permission denied/);
});

test("a singles match changes ratings only after the opponent confirms", async () => {
  const a = await signUp("Singles A");
  const b = await signUp("Singles B");
  const match = await recordMatch(a, "singles", [a], [b], [{ team1: 11, team2: 7 }, { team1: 9, team2: 11 }, { team1: 11, team2: 5 }]);
  const [row] = await asSuperuser("select status, winner_team, games from public.matches where id = $1", [match]);
  assert.equal(row.status, "pending");
  assert.equal(row.winner_team, 1);
  assert.equal((await player(a)).singles_rating, 1500);

  await rejects(as(a, "select public.respond_to_match($1, true)", [match]), /other team confirms/);
  const outsider = await signUp("Outsider");
  await rejects(as(outsider, "select public.respond_to_match($1, true)", [match]), /Only players in this match/);

  assert.equal((await as(b, "select public.respond_to_match($1, true) as r", [match]))[0].r, "confirmed");
  const [pa, pb] = [await player(a), await player(b)];
  assert.equal(pa.singles_rating, 1516);
  assert.equal(pb.singles_rating, 1484);
  assert.deepEqual([pa.singles_played, pa.singles_wins, pb.singles_played, pb.singles_wins], [1, 1, 1, 0]);
  assert.equal(pa.doubles_rating, 1500, "doubles rating is separate");
  const history = await asSuperuser("select player_id, rating_before, rating_after from public.rating_history where match_id = $1 order by rating_after", [match]);
  assert.deepEqual(history.map((h) => [h.rating_before, h.rating_after]), [[1500, 1484], [1500, 1516]]);
  await rejects(as(b, "select public.respond_to_match($1, true)", [match]), /already confirmed/);
});

test("match recording rejects bad input", async () => {
  const a = await signUp("Validate A");
  const b = await signUp("Validate B");
  const c = await signUp("Validate C");
  const ok = [{ team1: 11, team2: 3 }];
  await rejects(recordMatch(a, "singles", [b], [c], ok), /only record matches you played in/);
  await rejects(recordMatch(a, "singles", [a], [a], ok), /only appear once/);
  await rejects(recordMatch(a, "doubles", [a], [b], ok), /2 player\(s\) on each team/);
  await rejects(recordMatch(a, "singles", [a], [b], [{ team1: 11, team2: 11 }]), /cannot end in a tie/);
  await rejects(recordMatch(a, "singles", [a], [b], [{ team1: 11, team2: 3 }, { team1: 3, team2: 11 }]), /deciding game/);
  await rejects(recordMatch(a, "singles", [a], [b], [{ team1: 11.5, team2: 3 }]), /whole-number/);
  await rejects(recordMatch(a, "singles", [a], [b], []), /between 1 and 5 games/);
  await rejects(
    as(a, "select public.record_match('singles', now() + interval '1 day', array[$1]::uuid[], array[$2]::uuid[], $3::jsonb)", [a, b, JSON.stringify(ok)]),
    /not in the future/,
  );
  await rejects(
    as(a, "select public.record_match('singles', now() - interval '40 days', array[$1]::uuid[], array[$2]::uuid[], $3::jsonb)", [a, b, JSON.stringify(ok)]),
    /within 30 days/,
  );
});

test("doubles uses team averages and each player's own K-factor, matching lib/elo.ts", async () => {
  const [a, b, c, d] = [await signUp("Dbl A"), await signUp("Dbl B"), await signUp("Dbl C"), await signUp("Dbl D")];
  // Give A an established rating (K = 16) and uneven teams.
  await asSuperuser("update public.players set doubles_rating = 1620, doubles_played = 25 where id = $1", [a]);
  await asSuperuser("update public.players set doubles_rating = 1480, doubles_played = 3 where id = $1", [b]);
  await asSuperuser("update public.players set doubles_rating = 1550, doubles_played = 8 where id = $1", [c]);
  await asSuperuser("update public.players set doubles_rating = 1510, doubles_played = 0 where id = $1", [d]);
  const before = { a: await player(a), b: await player(b), c: await player(c), d: await player(d) };
  // Team 2 (C, D) wins.
  const match = await recordMatch(a, "doubles", [a, b], [c, d], [{ team1: 8, team2: 11 }]);
  await rejects(as(b, "select public.respond_to_match($1, true)", [match]), /other team confirms/);
  await as(d, "select public.respond_to_match($1, true)", [match]);

  const expected = rateMatch(
    [{ rating: 1620, played: 25 }, { rating: 1480, played: 3 }],
    [{ rating: 1550, played: 8 }, { rating: 1510, played: 0 }],
    2,
  );
  const after = [await player(a), await player(b), await player(c), await player(d)].map((p) => p.doubles_rating);
  assert.deepEqual(after, [...expected.team1, ...expected.team2]);
  assert.notEqual(after[0] - before.a.doubles_rating, after[1] - before.b.doubles_rating, "different K-factors move differently");
  assert.equal((await player(a)).singles_rating, 1500, "singles rating is separate");
});

test("TypeScript and SQL Elo agree across many rating gaps", async () => {
  const cases = [];
  for (const gap of [-450, -210, -99, -1, 0, 7, 55, 180, 333, 800]) {
    for (const played of [0, 19, 20]) cases.push({ gap, played });
  }
  for (const { gap, played } of cases) {
    const [a, b] = [await signUp("Gap A"), await signUp("Gap B")];
    await asSuperuser("update public.players set singles_rating = $2, singles_played = $3 where id = $1", [a, 1500 + gap, played]);
    await asSuperuser("update public.players set singles_played = $2 where id = $1", [b, played]);
    const match = await recordMatch(b, "singles", [a], [b], [{ team1: 5, team2: 11 }]);
    await as(a, "select public.respond_to_match($1, true)", [match]);
    const expected = rateMatch([{ rating: 1500 + gap, played }], [{ rating: 1500, played }], 2);
    assert.deepEqual([(await player(a)).singles_rating, (await player(b)).singles_rating], [...expected.team1, ...expected.team2], `gap ${gap}, played ${played}`);
  }
});

test("disputes go to an admin; voiding a confirmed match rebuilds ratings without it", async () => {
  const [a, b, admin] = [await signUp("Dispute A"), await signUp("Dispute B"), await signUp("Admin")];
  await asSuperuser("update public.players set is_admin = true where id = $1", [admin]);

  const disputed = await recordMatch(a, "singles", [a], [b], [{ team1: 11, team2: 0 }]);
  assert.equal((await as(b, "select public.respond_to_match($1, false) as r", [disputed]))[0].r, "disputed");
  assert.equal((await player(a)).singles_rating, 1500);
  await rejects(as(a, "select public.admin_resolve_match($1, 'confirm')", [disputed]), /Admin access/);

  const first = await recordMatch(a, "singles", [a], [b], [{ team1: 11, team2: 9 }]);
  await as(b, "select public.respond_to_match($1, true)", [first]);
  const second = await recordMatch(b, "singles", [a], [b], [{ team1: 4, team2: 11 }]);
  await as(a, "select public.respond_to_match($1, true)", [second]);
  const onlySecond = rateMatch([{ rating: 1500, played: 0 }], [{ rating: 1500, played: 0 }], 2);

  await as(admin, "select public.admin_resolve_match($1, 'void')", [first]);
  assert.deepEqual([(await player(a)).singles_rating, (await player(b)).singles_rating], [...onlySecond.team1, ...onlySecond.team2]);
  assert.equal((await player(a)).singles_played, 1);
  assert.equal((await asSuperuser("select count(*)::int as n from public.rating_history where match_id = $1", [first]))[0].n, 0);

  await as(admin, "select public.admin_resolve_match($1, 'confirm')", [disputed]);
  assert.equal((await asSuperuser("select status from public.matches where id = $1", [disputed]))[0].status, "confirmed");
  assert.equal((await player(a)).singles_played, 2);
});

test("the recorder can cancel a pending match, nobody else can", async () => {
  const [a, b] = [await signUp("Cancel A"), await signUp("Cancel B")];
  const match = await recordMatch(a, "singles", [a], [b], [{ team1: 11, team2: 2 }]);
  await rejects(as(b, "select public.cancel_match($1)", [match]), /Only the player who recorded/);
  await as(a, "select public.cancel_match($1)", [match]);
  await rejects(as(b, "select public.respond_to_match($1, true)", [match]), /already cancelled/);
});

test("club matches need members and build separate club ratings", async () => {
  const [owner, member, outsider] = [await signUp("Club Owner"), await signUp("Club Member"), await signUp("Club Outsider")];
  const club = (await as(owner, "select public.create_club('Makati Dinkers', 'NCR', 'Makati') as id"))[0].id;
  await rejects(as(member, "select public.create_club('makati dinkers', 'NCR')"), /already exists/);
  await as(member, "select public.join_club($1)", [club]);
  await rejects(recordMatch(owner, "singles", [owner], [outsider], [{ team1: 11, team2: 6 }], club), /member of the club/);

  // Owner already has a national singles rating from elsewhere; club rating starts fresh.
  await asSuperuser("update public.players set singles_rating = 1700, singles_played = 30 where id = $1", [owner]);
  const match = await recordMatch(owner, "singles", [owner], [member], [{ team1: 11, team2: 6 }], club);
  await as(member, "select public.respond_to_match($1, true)", [match]);

  const clubRatings = await asSuperuser("select player_id, rating, played, wins from public.club_ratings where club_id = $1 order by rating desc", [club]);
  assert.deepEqual(clubRatings.map((r) => [r.player_id, r.rating, r.played, r.wins]), [[owner, 1516, 1, 1], [member, 1484, 1, 0]]);
  const national = rateMatch([{ rating: 1700, played: 30 }], [{ rating: 1500, played: 0 }], 1);
  assert.equal((await player(owner)).singles_rating, national.team1[0], "national rating uses national numbers");

  await rejects(as(owner, "select public.leave_club($1)", [club]), /owner cannot leave/);
  await rejects(as(member, "select public.remove_club_member($1, $2)", [club, owner]), /Only club owners and admins/);
  await as(owner, "select public.remove_club_member($1, $2)", [club, member]);
  assert.equal((await asSuperuser("select count(*)::int as n from public.club_members where club_id = $1", [club]))[0].n, 1);
});

test("a 5-entry singles tournament seeds by rating, gives byes, and crowns a winner", async () => {
  const organizer = await signUp("Organizer");
  const players = [];
  for (const [index, rating] of [1400, 1650, 1500, 1720, 1580].entries()) {
    const id = await signUp(`Bracket ${index}`);
    await asSuperuser("update public.players set singles_rating = $2 where id = $1", [id, rating]);
    players.push(id);
  }
  const tournament = (await as(
    organizer,
    "select public.create_tournament('Cebu Open', 'singles', (now() at time zone 'Asia/Manila')::date, 'R7', 'Cebu City', 'IT Park Courts', null, 8) as id",
  ))[0].id;
  for (const id of players) await as(id, "select public.register_for_tournament($1)", [tournament]);
  await rejects(as(players[0], "select public.register_for_tournament($1)", [tournament]), /already registered/);
  await rejects(as(players[0], "select public.start_tournament($1)", [tournament]), /Only the organizer/);
  await as(organizer, "select public.start_tournament($1)", [tournament]);
  await rejects(as(organizer, "select public.register_for_tournament($1)", [tournament]), /closed/);

  const seeds = await asSuperuser("select player1_id, seed from public.tournament_entries where tournament_id = $1 order by seed", [tournament]);
  assert.deepEqual(seeds.map((s) => s.player1_id), [players[3], players[1], players[4], players[2], players[0]]);

  const slots = async () => asSuperuser(
    `select b.id, b.round, b.position, e1.seed as seed1, e2.seed as seed2, w.seed as winner
     from public.bracket_matches b
     left join public.tournament_entries e1 on e1.id = b.entry1_id
     left join public.tournament_entries e2 on e2.id = b.entry2_id
     left join public.tournament_entries w on w.id = b.winner_entry_id
     where b.tournament_id = $1 order by b.round, b.position`,
    [tournament],
  );
  let bracket = await slots();
  assert.equal(bracket.length, 7, "8-slot bracket: 4 + 2 + 1");
  // Round 1 pairs 1v8, 4v5, 2v7, 3v6; seeds 6-8 do not exist, so 1, 2, 3 get byes.
  assert.deepEqual(bracket.filter((s) => s.round === 1).map((s) => [s.seed1, s.seed2, s.winner]), [[1, null, 1], [4, 5, null], [2, null, 2], [3, null, 3]]);
  assert.deepEqual(bracket.filter((s) => s.round === 2).map((s) => [s.seed1, s.seed2]), [[1, null], [2, 3]]);

  const report = (slot, games) => as(organizer, "select public.report_bracket_result($1, $2::jsonb)", [slot.id, JSON.stringify(games)]);
  await rejects(report(bracket.find((s) => s.round === 2 && s.position === 0), [{ team1: 11, team2: 1 }]), /not decided yet/);
  await rejects(as(players[0], "select public.report_bracket_result($1, $2::jsonb)", [bracket[1].id, JSON.stringify([{ team1: 11, team2: 1 }])]), /Only the organizer/);
  await report(bracket.find((s) => s.round === 1 && s.position === 1), [{ team1: 6, team2: 11 }]); // seed 5 upsets seed 4
  bracket = await slots();
  assert.deepEqual(bracket.filter((s) => s.round === 2).map((s) => [s.seed1, s.seed2]), [[1, 5], [2, 3]]);
  await report(bracket.find((s) => s.round === 2 && s.position === 0), [{ team1: 11, team2: 4 }]);
  await report(bracket.find((s) => s.round === 2 && s.position === 1), [{ team1: 7, team2: 11 }, { team1: 11, team2: 9 }, { team1: 8, team2: 11 }]);
  bracket = await slots();
  const final = bracket.find((s) => s.round === 3);
  assert.deepEqual([final.seed1, final.seed2], [1, 3]);
  await report(final, [{ team1: 11, team2: 13 }]);

  const [done] = await asSuperuser(
    "select t.status, e.player1_id from public.tournaments t join public.tournament_entries e on e.id = t.winner_entry_id where t.id = $1",
    [tournament],
  );
  assert.equal(done.status, "completed");
  assert.equal(done.player1_id, players[4], "seed 3 (rated 1580) won the final");
  const matches = await asSuperuser("select count(*)::int as n, bool_and(status = 'confirmed') as ok from public.matches where tournament_id = $1", [tournament]);
  assert.deepEqual([matches[0].n, matches[0].ok], [4, true]);
  assert.notEqual((await player(players[4])).singles_rating, 1580, "bracket results update ratings");
});

test("doubles tournaments need a partner, and partner stats count wins together", async () => {
  const [a, b, c, d] = [await signUp("Pair A"), await signUp("Pair B"), await signUp("Pair C"), await signUp("Pair D")];
  const tournament = (await as(a, "select public.create_tournament('Davao Doubles', 'doubles', (now() at time zone 'Asia/Manila')::date, 'R11') as id"))[0].id;
  await rejects(as(a, "select public.register_for_tournament($1)", [tournament]), /Choose a doubles partner/);
  await as(a, "select public.register_for_tournament($1, $2)", [tournament, b]);
  await rejects(as(c, "select public.register_for_tournament($1, $2)", [tournament, b]), /already registered/);
  await as(c, "select public.register_for_tournament($1, $2)", [tournament, d]);
  await as(a, "select public.start_tournament($1)", [tournament]);
  const [final] = await asSuperuser("select id from public.bracket_matches where tournament_id = $1", [tournament]);
  await as(a, "select public.report_bracket_result($1, $2::jsonb)", [final.id, JSON.stringify([{ team1: 11, team2: 8 }])]);

  const casual = await recordMatch(a, "doubles", [a, b], [c, d], [{ team1: 5, team2: 11 }]);
  await as(c, "select public.respond_to_match($1, true)", [casual]);
  const stats = await as(null, "select matches, wins from public.partner_stats where player_id = $1 and partner_id = $2", [a, b]);
  assert.deepEqual([stats[0].matches, stats[0].wins], [2, 1]);
  assert.equal((await as(null, "select count(*)::int as n from public.partner_stats where player_id = $1", [a]))[0].n, 1, "opponents are not partners");
});

test("helper functions are not callable by clients", async () => {
  const a = await signUp("Helper Caller");
  const [anyMatch] = await asSuperuser("select id from public.matches where status = 'confirmed' limit 1");
  await rejects(as(a, "select public.apply_match_rating($1)", [anyMatch.id]), /permission denied/);
  await rejects(as(a, "select public.recompute_ratings('singles')"), /permission denied/);
  await rejects(as(a, "select public.advance_bracket($1, $1)", [anyMatch.id]), /permission denied/);
});

test("feedback: players send it, only admins read it and change its status", async () => {
  const [player, admin] = [await signUp("Feedback Player"), await signUp("Feedback Admin")];
  await asSuperuser("update public.players set is_admin = true where id = $1", [admin]);
  await rejects(as(null, "select public.send_feedback('suggestion', 'Please add a doubles ladder')"), /permission denied/);
  await rejects(as(player, "select public.send_feedback('other', 'Please add a doubles ladder')"), /Choose what your feedback is about/);
  await rejects(as(player, "select public.send_feedback('problem', 'hi')"), /Write a little more/);
  await rejects(as(player, "select public.send_feedback('problem', $1)", ["x".repeat(1001)]), /under 1000/);

  const id = (await as(player, "select public.send_feedback('suggestion', '  Please add a doubles ladder  ') as id"))[0].id;
  assert.equal((await asSuperuser("select message, status from public.feedback where id = $1", [id]))[0].message, "Please add a doubles ladder");
  assert.equal((await as(player, "select count(*)::int as n from public.feedback"))[0].n, 0, "players cannot read feedback");
  await rejects(as(null, "select count(*) from public.feedback"), /permission denied/);
  assert.equal((await as(admin, "select count(*)::int as n from public.feedback where id = $1", [id]))[0].n, 1, "admins can");
  await rejects(as(player, "insert into public.feedback (player_id, kind, message) values ($1, 'problem', 'direct insert')", [player]), /permission denied/);

  await rejects(as(player, "select public.admin_set_feedback_status($1, 'done')", [id]), /Admin access/);
  await as(admin, "select public.admin_set_feedback_status($1, 'done')", [id]);
  assert.equal((await asSuperuser("select status from public.feedback where id = $1", [id]))[0].status, "done");

  for (let i = 0; i < 4; i += 1) await as(player, "select public.send_feedback('problem', 'Another message here')");
  await rejects(as(player, "select public.send_feedback('problem', 'One message too many')"), /5 messages a day/);
});
