// Pure helpers shared by forms and pages. Run with `npm test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { playerIdFromCode } from "../lib/check-in.ts";
import { expectedScore, isProvisional, kFactor, rateMatch, teamRating } from "../lib/elo.ts";
import { daysAgoIso, formatGames, manilaInputToIso, manilaNowForInput, manilaToday, winRate } from "../lib/format.ts";
import { parseScoreLine, validateGames } from "../lib/games.ts";

test("score lines accept the ways people type them", () => {
  assert.deepEqual(parseScoreLine("11-7, 9-11, 11-5"), { games: [{ team1: 11, team2: 7 }, { team1: 9, team2: 11 }, { team1: 11, team2: 5 }] });
  assert.deepEqual(parseScoreLine("11–7 9–11 11:5"), { games: [{ team1: 11, team2: 7 }, { team1: 9, team2: 11 }, { team1: 11, team2: 5 }] });
  assert.deepEqual(parseScoreLine(" 15 - 13 "), { games: [{ team1: 15, team2: 13 }] });
});

test("score lines reject impossible results", () => {
  assert.match(parseScoreLine("").error, /Enter the score/);
  assert.match(parseScoreLine("11-11").error, /tie/);
  assert.match(parseScoreLine("11-7, 7-11").error, /deciding game/);
  assert.match(parseScoreLine("eleven-seven").error, /not a game score/);
  assert.match(parseScoreLine("11-7,11-7,11-7,11-7,11-7,11-7").error, /between 1 and 5/);
  assert.match(validateGames([{ team1: 100, team2: 1 }]).error, /0 to 99/);
});

test("Manila time conversions (UTC+8, no daylight saving)", () => {
  assert.equal(manilaInputToIso("2026-09-26T18:30"), "2026-09-26T10:30:00.000Z");
  assert.equal(manilaInputToIso("2026-09-26 18:30"), null);
  assert.equal(manilaNowForInput(new Date("2026-09-26T17:05:00Z")), "2026-09-27T01:05");
  assert.equal(manilaToday(new Date("2026-09-26T17:05:00Z")), "2026-09-27");
  assert.equal(daysAgoIso(14, new Date("2026-09-26T00:00:00Z")), "2026-09-12T00:00:00.000Z");
});

test("display helpers", () => {
  assert.equal(formatGames([{ team1: 11, team2: 7 }, { team1: 9, team2: 11 }]), "11–7, 9–11");
  assert.equal(winRate(0, 0), "–");
  assert.equal(winRate(2, 3), "67%");
});

test("Elo basics", () => {
  assert.equal(kFactor(0), 32);
  assert.equal(kFactor(19), 32);
  assert.equal(kFactor(20), 16);
  assert.equal(expectedScore(1500, 1500), 0.5);
  assert.ok(expectedScore(1700, 1500) > 0.75);
  assert.equal(teamRating([1600, 1400]), 1500);
  assert.deepEqual(rateMatch([{ rating: 1500, played: 0 }], [{ rating: 1500, played: 0 }], 1), { team1: [1516], team2: [1484] });
  assert.equal(isProvisional(4), true);
  assert.equal(isProvisional(5), false);
});

test("check-in QR codes resolve to a player id", () => {
  const id = "0f5e6c5a-1b2c-4d3e-8f90-123456789abc";
  assert.equal(playerIdFromCode(`https://pickle-rating.vercel.app/matches/new?add=${id}`), id);
  assert.equal(playerIdFromCode(`https://pickle-rating.vercel.app/players/${id}`), id);
  assert.equal(playerIdFromCode("https://example.com/matches/new?add=not-an-id"), null);
  assert.equal(playerIdFromCode("hello"), null);
});
