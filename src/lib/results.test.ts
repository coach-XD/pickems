import { describe, expect, it } from "vitest";
import { gradePlacementPick, gradeRealMatch, gradeSeriesPick, latestScoredMatch, pointsOnSeries } from "./results";

describe("series verdicts", () => {
  it("pays 1 for a correct winner and another 1 for the exact Bo3 score", () => {
    expect(
      gradeSeriesPick({
        format: "bo3",
        pickWinnerId: "a",
        pickScoreA: 2,
        pickScoreB: 0,
        resultWinnerId: "a",
        resultScoreA: 2,
        resultScoreB: 0,
      }),
    ).toEqual({ tone: "correct", points: 2, winnerPoints: 1, mapPoints: 1, exact: true, mismatch: false });
  });

  it("stays correct without the map point when the Bo3 margin is wrong", () => {
    expect(
      gradeSeriesPick({
        format: "bo3",
        pickWinnerId: "a",
        pickScoreA: 2,
        pickScoreB: 1,
        resultWinnerId: "a",
        resultScoreA: 2,
        resultScoreB: 0,
      }),
    ).toMatchObject({ tone: "correct", points: 1, exact: false });
  });

  it("marks a wrong winner and a missing result", () => {
    expect(
      gradeSeriesPick({
        format: "bo1",
        pickWinnerId: "b",
        pickScoreA: null,
        pickScoreB: null,
        resultWinnerId: "a",
        resultScoreA: 1,
        resultScoreB: 0,
      }).tone,
    ).toBe("wrong");
    expect(
      gradeSeriesPick({
        format: "bo1",
        pickWinnerId: "a",
        pickScoreA: null,
        pickScoreB: null,
        resultWinnerId: null,
        resultScoreA: null,
        resultScoreB: null,
      }),
    ).toMatchObject({ tone: "pending", points: 0 });
    expect(
      gradeSeriesPick({
        format: "bo1",
        pickWinnerId: null,
        pickScoreA: null,
        pickScoreB: null,
        resultWinnerId: "a",
        resultScoreA: 1,
        resultScoreB: 0,
      }).tone,
    ).toBe("empty");
  });
});

describe("record pools", () => {
  it("pays neither the winner nor the exact Bo3 point when the pool differs", () => {
    const grade = gradeRealMatch({
      pick: {
        round: 3,
        wins: 0,
        losses: 2,
        format: "bo3",
        teamAId: "nip",
        teamBId: "lv",
        winnerId: "nip",
        scoreA: 2,
        scoreB: 0,
      },
      real: {
        round: 3,
        teamAId: "nip",
        teamBId: "lv",
        format: "bo3",
        winnerId: "nip",
        scoreA: 2,
        scoreB: 0,
      },
      pool: { wins: 2, losses: 0 },
    });
    expect(grade).toMatchObject({ tone: "wrong", points: 0, mapPoints: 0, exact: false, mismatch: true });
  });
});

describe("placement verdicts", () => {
  it("keeps 3-0, 0-3, and advance pending until the record is decided", () => {
    expect(gradePlacementPick("perfect", 2, 0)).toEqual({ tone: "pending", points: 0 });
    expect(gradePlacementPick("winless", 0, 2)).toEqual({ tone: "pending", points: 0 });
    expect(gradePlacementPick("advance", 2, 2)).toEqual({ tone: "pending", points: 0 });
    expect(gradePlacementPick("perfect", 3, 0)).toEqual({ tone: "correct", points: 5 });
    expect(gradePlacementPick("perfect", 3, 1)).toEqual({ tone: "wrong", points: 0 });
    expect(gradePlacementPick("winless", 0, 3)).toEqual({ tone: "correct", points: 5 });
    expect(gradePlacementPick("advance", 3, 2)).toEqual({ tone: "correct", points: 2 });
    expect(gradePlacementPick("advance", 1, 3)).toEqual({ tone: "wrong", points: 0 });
  });
});

describe("points from the latest result", () => {
  const teams = [
    { teamId: "a", seed: 1 },
    { teamId: "b", seed: 9 },
  ];
  const round1 = [{ teamAId: "a", teamBId: "b" }];
  const match = {
    round: 1,
    teamAId: "a",
    teamBId: "b",
    format: "bo3" as const,
    winnerId: "a",
    scoreA: 2,
    scoreB: 1,
  };

  it("uses the most recently saved result", () => {
    const older = new Date("2026-11-24T04:10:00Z");
    const newer = new Date("2026-11-24T05:10:00Z");
    const latest = latestScoredMatch([
      { ...match, resultAt: older, scheduledAt: older, winnerId: "a" },
      { ...match, teamAId: "c", teamBId: "d", resultAt: newer, scheduledAt: older, winnerId: "c" },
    ]);
    expect(latest?.teamAId).toBe("c");
  });

  it("counts only that series for the player who called it", () => {
    expect(
      pointsOnSeries({
        teams,
        round1,
        picks: [{ round: 1, teamAId: "a", teamBId: "b", winnerId: "a", scoreA: 2, scoreB: 1 }],
        match,
      }),
    ).toBe(1);
    expect(
      pointsOnSeries({
        teams,
        round1,
        picks: [{ round: 1, teamAId: "a", teamBId: "b", winnerId: "b", scoreA: 2, scoreB: 0 }],
        match,
      }),
    ).toBe(0);
  });
});
