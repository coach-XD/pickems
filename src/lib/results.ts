import { projectBracket, type BracketPick, type RealSeries } from "./bracket";
import { scoreMatchPick, scorePlacementSlot } from "./scoring";
import { pairKey } from "./swiss";
import type { SeriesFormat, Slot } from "./types";

export type PickTone = "correct" | "wrong" | "pending" | "empty";

export type SeriesGrade = {
  tone: PickTone;
  points: number;
  winnerPoints: number;
  mapPoints: number;
  exact: boolean;
};

export type PlacementGrade = {
  tone: Exclude<PickTone, "empty">;
  points: number;
};

/**
 * Correct is a right winner. The extra map point is only an exact Bo3 score.
 * Pending means the series has no result yet. Empty means the player never picked it.
 */
export function gradeSeriesPick(input: {
  format: SeriesFormat;
  pickWinnerId: string | null;
  pickScoreA: number | null;
  pickScoreB: number | null;
  resultWinnerId: string | null;
  resultScoreA: number | null;
  resultScoreB: number | null;
}): SeriesGrade {
  if (!input.pickWinnerId) {
    return { tone: input.resultWinnerId ? "empty" : "pending", points: 0, winnerPoints: 0, mapPoints: 0, exact: false };
  }
  if (!input.resultWinnerId) {
    return { tone: "pending", points: 0, winnerPoints: 0, mapPoints: 0, exact: false };
  }
  const scored = scoreMatchPick({
    format: input.format,
    pickWinnerId: input.pickWinnerId,
    pickScoreA: input.pickScoreA,
    pickScoreB: input.pickScoreB,
    resultWinnerId: input.resultWinnerId,
    resultScoreA: input.resultScoreA,
    resultScoreB: input.resultScoreB,
  });
  return {
    tone: scored.winnerPoints > 0 ? "correct" : "wrong",
    points: scored.winnerPoints + scored.mapPoints,
    winnerPoints: scored.winnerPoints,
    mapPoints: scored.mapPoints,
    exact: scored.mapPoints > 0,
  };
}

/** 3-0, 0-3, and advance stay pending until the real record decides them. */
export function gradePlacementPick(slot: Slot, wins: number, losses: number): PlacementGrade {
  const scored = scorePlacementSlot(slot, wins, losses);
  if (scored.correct == null) return { tone: "pending", points: 0 };
  return { tone: scored.correct ? "correct" : "wrong", points: scored.points };
}

export function latestScoredMatch<T extends { winnerId: string | null; resultAt: Date | null; scheduledAt: Date; round: number }>(
  matches: T[],
): T | null {
  const done = matches.filter((match) => match.winnerId);
  if (done.length === 0) return null;
  return done.sort((a, b) => {
    const stamped = (b.resultAt?.getTime() ?? 0) - (a.resultAt?.getTime() ?? 0);
    if (stamped !== 0) return stamped;
    if (a.round !== b.round) return b.round - a.round;
    return b.scheduledAt.getTime() - a.scheduledAt.getTime();
  })[0];
}

/** Points one player earned from a single real series. Placement points are not included. */
export function pointsOnSeries(input: {
  teams: Array<{ teamId: string; seed: number }>;
  round1: Array<{ teamAId: string; teamBId: string }>;
  picks: BracketPick[];
  match: RealSeries;
}): number {
  const simulated = projectBracket({ teams: input.teams, round1: input.round1, picks: input.picks });
  const key = pairKey(input.match.teamAId, input.match.teamBId);
  const pick =
    simulated.find((row) => row.round === input.match.round && pairKey(row.teamAId, row.teamBId) === key) ??
    simulated.find((row) => pairKey(row.teamAId, row.teamBId) === key);
  if (!pick) return 0;
  return gradeSeriesPick({
    format: input.match.format,
    pickWinnerId: pick.winnerId,
    pickScoreA: pick.scoreA,
    pickScoreB: pick.scoreB,
    resultWinnerId: input.match.winnerId,
    resultScoreA: input.match.scoreA,
    resultScoreB: input.match.scoreB,
  }).points;
}
