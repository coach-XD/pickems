import { describe, expect, it } from "vitest";
import { derivedPlacements, projectBracket, scoreBracket, type BracketPick } from "./bracket";
import { pointsOnSeries } from "./results";
import { pairKey } from "./swiss";
import { initialSwissPairs } from "./valveSwiss";

const teams = Array.from({ length: 16 }, (_, index) => ({ teamId: String(index + 1), seed: index + 1 }));

function decide(picks: BracketPick[], round: number, teamAId: string, teamBId: string, winnerId: string, margin: "2-0" | "2-1" | null) {
  const winnerIsA = winnerId === teamAId;
  picks.push({
    round,
    teamAId,
    teamBId,
    winnerId,
    scoreA: margin == null ? null : winnerIsA ? 2 : margin === "2-0" ? 0 : 1,
    scoreB: margin == null ? null : winnerIsA ? (margin === "2-0" ? 0 : 1) : 2,
  });
}

describe("simulated bracket", () => {
  it("lists round 1 from the best seed down", () => {
    const round1 = [
      { teamAId: "8", teamBId: "16" },
      { teamAId: "3", teamBId: "11" },
      { teamAId: "1", teamBId: "9" },
    ];
    const shown = projectBracket({ teams, round1, picks: [] }).filter((match) => match.round === 1);
    expect(shown.map((match) => match.teamAId)).toEqual(["1", "3", "8"]);
  });

  it("opens the next round only after the current one is complete", () => {
    const round1 = initialSwissPairs(teams);
    const partial = projectBracket({
      teams,
      round1,
      picks: [{ round: 1, teamAId: "1", teamBId: "9", winnerId: "1", scoreA: null, scoreB: null }],
    });
    expect(partial.some((match) => match.round === 2)).toBe(false);
    expect(partial.filter((match) => match.round === 1)).toHaveLength(8);

    const picks: BracketPick[] = [];
    for (const pair of round1) decide(picks, 1, pair.teamAId, pair.teamBId, pair.teamAId, null);
    const full = projectBracket({ teams, round1, picks });
    const round2 = full.filter((match) => match.round === 2);
    expect(round2.map((match) => `${match.wins}-${match.losses}`).sort()).toEqual([
      ..."0-1".repeat(4).match(/.{3}/g)!,
      ..."1-0".repeat(4).match(/.{3}/g)!,
    ].sort());
    expect(round2).toHaveLength(8);
  });

  it("scores a matchup only when the admin plays the same teams", () => {
    const round1 = initialSwissPairs(teams);
    const picks: BracketPick[] = [
      { round: 1, teamAId: "1", teamBId: "9", winnerId: "1", scoreA: null, scoreB: null },
      { round: 1, teamAId: "2", teamBId: "10", winnerId: "10", scoreA: null, scoreB: null },
    ];
    const realRecords = new Map<string, { wins: number; losses: number }>([
      ["1", { wins: 3, losses: 0 }],
      ["9", { wins: 0, losses: 3 }],
    ]);
    const matched = scoreBracket({
      teams,
      round1,
      picks,
      realMatches: [
        { round: 1, teamAId: "9", teamBId: "1", format: "bo1", winnerId: "1", scoreA: 0, scoreB: 1 },
        { round: 1, teamAId: "2", teamBId: "10", format: "bo1", winnerId: "2", scoreA: 1, scoreB: 0 },
      ],
      realRecords,
    });
    expect(matched.matchPoints).toBe(1);

    const missing = scoreBracket({
      teams,
      round1,
      picks,
      realMatches: [],
      realRecords,
    });
    expect(missing).toMatchObject({ matchPoints: 0, mapPoints: 0 });
  });

  it("pays the map bonus only for the same Bo3 margin", () => {
    const round1 = [
      { teamAId: "1", teamBId: "5" },
      { teamAId: "2", teamBId: "6" },
      { teamAId: "3", teamBId: "7" },
      { teamAId: "4", teamBId: "8" },
    ];
    const roster = [1, 2, 3, 4, 5, 6, 7, 8].map((seed) => ({ teamId: String(seed), seed }));
    const picks: BracketPick[] = [];
    for (const pair of round1) decide(picks, 1, pair.teamAId, pair.teamBId, pair.teamAId, null);
    let projected = projectBracket({ teams: roster, round1, picks });
    for (const match of projected.filter((match) => match.round === 2)) {
      decide(picks, 2, match.teamAId, match.teamBId, match.teamAId, null);
    }
    projected = projectBracket({ teams: roster, round1, picks });
    const decider = projected.find((match) => match.round === 3 && match.format === "bo3");
    expect(decider).toBeTruthy();
    decide(picks, 3, decider!.teamAId, decider!.teamBId, decider!.teamAId, "2-1");
    const earlier = projected
      .filter((match) => match.round < 3 && match.winnerId)
      .map((match) => ({
        round: match.round,
        teamAId: match.teamAId,
        teamBId: match.teamBId,
        format: match.format,
        winnerId: match.winnerId,
        scoreA: match.winnerId === match.teamAId ? 1 : 0,
        scoreB: match.winnerId === match.teamBId ? 1 : 0,
      }));
    const real = {
      round: 3,
      teamAId: decider!.teamBId,
      teamBId: decider!.teamAId,
      format: "bo3" as const,
      winnerId: decider!.teamAId,
      scoreA: 1,
      scoreB: 2,
    };
    const exact = scoreBracket({
      teams: roster,
      round1,
      picks,
      realMatches: [...earlier, real],
      realRecords: new Map([[decider!.teamAId, { wins: 3, losses: 0 }]]),
    });
    expect(exact).toMatchObject({ matchPoints: earlier.length + 1, mapPoints: 1 });

    const wrongMargin = scoreBracket({
      teams: roster,
      round1,
      picks,
      realMatches: [...earlier, { ...real, scoreA: 0, scoreB: 2 }],
      realRecords: new Map(),
    });
    expect(wrongMargin).toMatchObject({ matchPoints: earlier.length + 1, mapPoints: 0 });
  });

  it("does not pay Sam for a 0-1 NiP pick when they meet in the 1-0 pool, or the reverse", () => {
    const roster = teams;
    const round1 = initialSwissPairs(roster);
    const nipLoses = (pair: { teamAId: string; teamBId: string }) => (pair.teamAId === "1" ? pair.teamBId : pair.teamAId);
    const bothWin = (pair: { teamAId: string; teamBId: string }) => (pair.teamBId === "16" ? pair.teamBId : pair.teamAId);

    function path(winnerOf: (pair: { teamAId: string; teamBId: string }) => string) {
      const picks: BracketPick[] = [];
      for (const pair of round1) decide(picks, 1, pair.teamAId, pair.teamBId, winnerOf(pair), null);
      const projected = projectBracket({ teams: roster, round1, picks });
      const meeting = projected.find((match) => match.round === 2 && pairKey(match.teamAId, match.teamBId) === pairKey("1", "16"));
      return { picks, projected, meeting };
    }

    const low = path(nipLoses);
    const high = path(bothWin);
    expect(low.meeting).toMatchObject({ wins: 0, losses: 1 });
    expect(high.meeting).toMatchObject({ wins: 1, losses: 0 });
    decide(low.picks, 2, low.meeting!.teamAId, low.meeting!.teamBId, "1", null);
    decide(high.picks, 2, high.meeting!.teamAId, high.meeting!.teamBId, "1", null);

    const realRound1 = round1.map((pair) => ({
      round: 1,
      teamAId: pair.teamAId,
      teamBId: pair.teamBId,
      format: "bo1" as const,
      winnerId: bothWin(pair),
      scoreA: bothWin(pair) === pair.teamAId ? 1 : 0,
      scoreB: bothWin(pair) === pair.teamBId ? 1 : 0,
    }));
    const realHigh = {
      round: 2,
      teamAId: high.meeting!.teamAId,
      teamBId: high.meeting!.teamBId,
      format: high.meeting!.format,
      winnerId: "1",
      scoreA: high.meeting!.teamAId === "1" ? 1 : 0,
      scoreB: high.meeting!.teamBId === "1" ? 1 : 0,
    };
    const slate = [...realRound1, realHigh];
    expect(pointsOnSeries({ teams: roster, round1, picks: low.picks, match: realHigh, slate })).toBe(0);
    expect(pointsOnSeries({ teams: roster, round1, picks: high.picks, match: realHigh, slate })).toBe(1);

    const realLowRound1 = round1.map((pair) => ({
      round: 1,
      teamAId: pair.teamAId,
      teamBId: pair.teamBId,
      format: "bo1" as const,
      winnerId: nipLoses(pair),
      scoreA: nipLoses(pair) === pair.teamAId ? 1 : 0,
      scoreB: nipLoses(pair) === pair.teamBId ? 1 : 0,
    }));
    const realLow = {
      round: 2,
      teamAId: low.meeting!.teamAId,
      teamBId: low.meeting!.teamBId,
      format: low.meeting!.format,
      winnerId: "1",
      scoreA: low.meeting!.teamAId === "1" ? 1 : 0,
      scoreB: low.meeting!.teamBId === "1" ? 1 : 0,
    };
    const lowSlate = [...realLowRound1, realLow];
    expect(pointsOnSeries({ teams: roster, round1, picks: high.picks, match: realLow, slate: lowSlate })).toBe(0);
    expect(pointsOnSeries({ teams: roster, round1, picks: low.picks, match: realLow, slate: lowSlate })).toBe(1);
    expect(scoreBracket({ teams: roster, round1, picks: low.picks, realMatches: slate, realRecords: new Map() }).matchPoints).toBe(
      scoreBracket({ teams: roster, round1, picks: low.picks.filter((pick) => pick.round === 1), realMatches: slate, realRecords: new Map() }).matchPoints,
    );
  });

  it("does not award a 3-0 slot until the bracket actually reaches 3-0", () => {
    const open = projectBracket({ teams, round1: initialSwissPairs(teams), picks: [] });
    expect(derivedPlacements(teams, open)).toEqual([]);
  });
});
