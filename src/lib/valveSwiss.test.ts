import { describe, expect, it } from "vitest";
import { STAGE1_MATCHES, STAGE1_TEAMS } from "@/db/stage1";
import { pairKey } from "./swiss";
import { difficultyScore, initialSwissPairs, pairNextRound, pairRecordPool } from "./valveSwiss";

const field = Array.from({ length: 16 }, (_, index) => ({ teamId: String(index + 1), seed: index + 1 }));

describe("Valve Swiss pairings", () => {
  it("opens 1 vs 9 through 8 vs 16", () => {
    expect(initialSwissPairs(field).map((pair) => `${pair.teamAId}-${pair.teamBId}`)).toEqual([
      "1-9",
      "2-10",
      "3-11",
      "4-12",
      "5-13",
      "6-14",
      "7-15",
      "8-16",
    ]);
  });

  it("matches the Stage 1 Round 1 pairs stored for the major", () => {
    const name = new Map(STAGE1_TEAMS.map((team) => [team.seed, team.name]));
    const pairs = STAGE1_MATCHES.map((match) => [name.get(match.seedA), name.get(match.seedB)].sort().join(" vs ")).sort();
    expect(pairs).toEqual(
      [
        "100 Thieves vs Chinggis Warriors",
        "9z vs Lynn Vision",
        "BC.Game (GOSH) vs Liquid",
        "DENDELE vs PARIVISION",
        "Eternal Fire vs FlyQuest",
        "FaZe vs Wildcard",
        "HEROIC vs Imperial",
        "M80 vs Ninjas in Pyjamas",
      ].sort(),
    );
    const stored = STAGE1_MATCHES.map((match) => `${match.seedA}-${match.seedB}`).sort();
    const opening = initialSwissPairs(STAGE1_TEAMS.map((team) => ({ teamId: String(team.seed), seed: team.seed })))
      .map((pair) => `${pair.teamAId}-${pair.teamBId}`)
      .sort();
    expect(stored).toEqual(opening);
  });

  it("uses the rulebook Buchholz example", () => {
    expect(difficultyScore([{ wins: 2, losses: 0 }, { wins: 1, losses: 1 }])).toBe(2);
    expect(difficultyScore([{ wins: 1, losses: 1 }, { wins: 1, losses: 1 }])).toBe(0);
  });

  it("pairs round 2 high seed against low seed, then avoids a rematch", () => {
    const completed = initialSwissPairs(field).map((pair) => ({
      round: 1,
      teamAId: pair.teamAId,
      teamBId: pair.teamBId,
      winnerId: pair.teamAId,
    }));
    const round2 = pairNextRound({ teams: field, completed, round: 2 }).filter((pair) => pair.wins === 1 && pair.losses === 0);
    expect(round2.map((pair) => `${pair.teamAId}-${pair.teamBId}`)).toEqual(["1-8", "2-7", "3-6", "4-5"]);
    expect(round2.every((pair) => pair.format === "bo1" && !pair.rematch)).toBe(true);

    const pool = [1, 2, 3, 4].map((seed) => ({
      teamId: String(seed),
      seed,
      wins: 1,
      losses: 0,
      buchholz: 0,
    }));
    const avoided = pairRecordPool(2, pool, new Set([pairKey("1", "4")]));
    expect(avoided.map((pair) => `${pair.teamAId}-${pair.teamBId}`).sort()).toEqual(["1-3", "2-4"]);
    expect(avoided.every((pair) => !pair.rematch)).toBe(true);
  });

  it("uses the priority table once six teams remain", () => {
    const six = [1, 2, 3, 4, 5, 6].map((seed) => ({ teamId: String(seed), seed }));
    const clean = pairNextRound({ teams: six, completed: [], round: 4 });
    expect(clean.map((pair) => [pair.teamAId, pair.teamBId].sort().join(""))).toEqual(["16", "25", "34"]);

    const shifted = pairRecordPool(
      4,
      six.map((team) => ({ ...team, wins: 2, losses: 2, buchholz: 0 })),
      new Set([pairKey("1", "6")]),
    );
    expect(shifted.map((pair) => [pair.teamAId, pair.teamBId].sort().join(""))).toEqual(["15", "26", "34"]);
    expect(shifted.every((pair) => !pair.rematch)).toBe(true);
  });

  it("makes advancement and elimination matches best of three", () => {
    const teams = [1, 2, 3, 4, 5, 6, 7, 8].map((seed) => ({ teamId: String(seed), seed }));
    const completed = [
      { round: 1, teamAId: "1", teamBId: "5", winnerId: "1" },
      { round: 1, teamAId: "2", teamBId: "6", winnerId: "2" },
      { round: 1, teamAId: "3", teamBId: "7", winnerId: "3" },
      { round: 1, teamAId: "4", teamBId: "8", winnerId: "4" },
      { round: 2, teamAId: "1", teamBId: "4", winnerId: "1" },
      { round: 2, teamAId: "2", teamBId: "3", winnerId: "2" },
      { round: 2, teamAId: "5", teamBId: "8", winnerId: "5" },
      { round: 2, teamAId: "6", teamBId: "7", winnerId: "6" },
    ];
    const round3 = pairNextRound({ teams, completed, round: 3 });
    const advancement = round3.find((pair) => pair.wins === 2 && pair.losses === 0);
    const elimination = round3.find((pair) => pair.wins === 0 && pair.losses === 2);
    expect(advancement?.format).toBe("bo3");
    expect(elimination?.format).toBe("bo3");
  });
});
