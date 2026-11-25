import { describe, expect, it } from "vitest";
import { addStageScores, scoreMatchPick, scorePlacementSlot, scorePlayerStage } from "./scoring";

describe("placement slots", () => {
  it("pays 5 for an exact 3-0 and 0 when that team advances another way", () => {
    expect(scorePlacementSlot("perfect", 3, 0)).toEqual({ points: 5, correct: true });
    expect(scorePlacementSlot("perfect", 3, 1)).toEqual({ points: 0, correct: false });
    expect(scorePlacementSlot("perfect", 3, 2)).toEqual({ points: 0, correct: false });
    expect(scorePlacementSlot("perfect", 2, 0).correct).toBeNull();
    expect(scorePlacementSlot("perfect", 2, 1)).toEqual({ points: 0, correct: false });
  });

  it("pays 5 for an exact 0-3 and 0 when the team loses with a win", () => {
    expect(scorePlacementSlot("winless", 0, 3)).toEqual({ points: 5, correct: true });
    expect(scorePlacementSlot("winless", 1, 3)).toEqual({ points: 0, correct: false });
    expect(scorePlacementSlot("winless", 2, 3)).toEqual({ points: 0, correct: false });
    expect(scorePlacementSlot("winless", 0, 2).correct).toBeNull();
    expect(scorePlacementSlot("winless", 1, 0)).toEqual({ points: 0, correct: false });
  });

  it("pays 2 for an advance pick only on a real 3-1 or 3-2", () => {
    expect(scorePlacementSlot("advance", 3, 0)).toEqual({ points: 0, correct: false });
    expect(scorePlacementSlot("advance", 3, 1)).toEqual({ points: 2, correct: true });
    expect(scorePlacementSlot("advance", 3, 2)).toEqual({ points: 2, correct: true });
    expect(scorePlacementSlot("advance", 0, 3)).toEqual({ points: 0, correct: false });
    expect(scorePlacementSlot("advance", 1, 3)).toEqual({ points: 0, correct: false });
    expect(scorePlacementSlot("advance", 2, 3)).toEqual({ points: 0, correct: false });
    expect(scorePlacementSlot("advance", 2, 0).correct).toBeNull();
    expect(scorePlacementSlot("advance", 2, 1).correct).toBeNull();
  });
});

describe("match points", () => {
  it("awards the map bonus only on a correct Bo3 winner with the exact score", () => {
    expect(
      scoreMatchPick({
        format: "bo3",
        pickWinnerId: "a",
        pickScoreA: 2,
        pickScoreB: 1,
        resultWinnerId: "a",
        resultScoreA: 2,
        resultScoreB: 1,
      }),
    ).toEqual({ winnerPoints: 1, mapPoints: 1 });

    expect(
      scoreMatchPick({
        format: "bo3",
        pickWinnerId: "a",
        pickScoreA: 2,
        pickScoreB: 0,
        resultWinnerId: "a",
        resultScoreA: 2,
        resultScoreB: 1,
      }),
    ).toEqual({ winnerPoints: 1, mapPoints: 0 });

    expect(
      scoreMatchPick({
        format: "bo3",
        pickWinnerId: "b",
        pickScoreA: 2,
        pickScoreB: 1,
        resultWinnerId: "a",
        resultScoreA: 2,
        resultScoreB: 1,
      }),
    ).toEqual({ winnerPoints: 0, mapPoints: 0 });
  });

  it("does not pay a map bonus on Bo1 even when the 1-0 score matches", () => {
    expect(
      scoreMatchPick({
        format: "bo1",
        pickWinnerId: "a",
        pickScoreA: 1,
        pickScoreB: 0,
        resultWinnerId: "a",
        resultScoreA: 1,
        resultScoreB: 0,
      }),
    ).toEqual({ winnerPoints: 1, mapPoints: 0 });
  });

  it("leaves an unplayed match unscored", () => {
    const score = scorePlayerStage({
      matches: [{ id: "m", format: "bo1", winnerId: null, scoreA: null, scoreB: null }],
      matchPicks: [{ matchId: "m", winnerId: "a", scoreA: null, scoreB: null }],
      placementPicks: [],
      records: new Map(),
    });
    expect(score).toEqual({ matchPoints: 0, mapPoints: 0, placementPoints: 0, correctPlacements: 0 });
  });
});

describe("stage totals", () => {
  it("sums stages without treating a wrong 3-0 as an advance point", () => {
    const first = scorePlayerStage({
      matches: [],
      matchPicks: [],
      placementPicks: [{ teamId: "hero", slot: "perfect" }],
      records: new Map([["hero", { wins: 3, losses: 1 }]]),
    });
    const second = scorePlayerStage({
      matches: [{ id: "m", format: "bo1", winnerId: "a", scoreA: 1, scoreB: 0 }],
      matchPicks: [{ matchId: "m", winnerId: "a", scoreA: null, scoreB: null }],
      placementPicks: [{ teamId: "hero", slot: "advance" }],
      records: new Map([["hero", { wins: 3, losses: 1 }]]),
    });
    expect(first).toMatchObject({ placementPoints: 0, correctPlacements: 0 });
    expect(second).toMatchObject({ matchPoints: 1, placementPoints: 2, correctPlacements: 1 });
    const perfectAdvance = scorePlayerStage({
      matches: [],
      matchPicks: [],
      placementPicks: [{ teamId: "hero", slot: "advance" }],
      records: new Map([["hero", { wins: 3, losses: 0 }]]),
    });
    expect(perfectAdvance).toMatchObject({ placementPoints: 0, correctPlacements: 0 });
    expect(addStageScores(first, second)).toMatchObject({
      matchPoints: 1,
      mapPoints: 0,
      placementPoints: 2,
      correctPlacements: 1,
    });
  });
});
